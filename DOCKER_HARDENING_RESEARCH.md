# Docker hardening research — Mere Medical

Research date: 2026-08-17. Compiled from three deep-research passes (image/Dockerfile,
compose/runtime, CI/supply-chain), each grounded in current sources: Docker docs, OWASP
Docker + Node.js Docker cheat sheets, CIS Docker Benchmark v1.7, Compose Specification,
Node.js release schedule, and peer self-hosted projects (Immich, Nextcloud AIO, Vaultwarden).

## Current state (audited in this repo)

- `Dockerfile`: build stages on `node:20.19.0`, runtime stage `node:18-alpine` — Node 18
  EOL since April 2025, Node 20 EOL since April 2026. No `USER` (runs as root), NestJS
  listens on port 80 (`apps/api/src/main.ts` `DEFAULT_PORT = 80`), serves web via
  `ServeStaticModule`. Build runs `curl -sf https://gobinaries.com/tj/node-prune | sh`,
  then `npm prune --production`, and ships the full `node_modules`.
- `.dockerignore`: only `node_modules` + `npm-debug.log`, while Dockerfile does
  `COPY . /app/` — `.git`, local `.env`, compose files, etc. enter build-stage layers.
- `Dockerfile-docs`: build on `node:20.11.0` (`npm install`, not `ci`), runtime
  `nginx:1.23` (EOL, root).
- `docker-compose.yaml` + `examples/…nginx-ssl/docker-compose.yaml`: obsolete `version:`
  key, no restart policy, no `init`, no `cap_drop` / `no-new-privileges` / `read_only` /
  limits, ports on all interfaces, `ONPATIENT_CLIENT_SECRET` / `HEALOW_CLIENT_SECRET` as
  plain env vars, example proxy uses `nginx:latest`.
- CI (`production.yaml` etc.): buildx multi-platform push-by-digest + `imagetools create`
  merge; actions tag-pinned (not SHA-pinned), no `permissions:` blocks, no scanning, no
  SBOM/provenance, no signing.

## Prioritized findings and recommendations

### P1 — supply chain / patchability

1. **EOL runtime base.** Move runtime to Node 24 (Active LTS, EOL 2028) and unify build
   stages on the same major. `node:24-alpine` is the least-disruptive move from
   `18-alpine`; `node:24-bookworm-slim` is the most-compatible (glibc). Distroless
   (`gcr.io/distroless/nodejs24-debian13`) is a later stretch goal.
2. **Remove `curl | sh` node-prune.** `tj/node-prune` last pushed 2022, gobinaries.com
   unmaintained since 2021 yet still serving an unauthenticated install script — remote
   code execution in every build. Replace the install-everything-then-prune flow with a
   dedicated prod-deps stage: `npm ci --omit=dev` from lockfile, copy that
   `node_modules` into the runtime stage. (Optional later: webpack-bundle the Nest build
   and ship no node_modules at all — needs per-dependency testing.)
3. **Expand `.dockerignore`.** Load-bearing entries: `.git`, `.env*`, `.npmrc`,
   `node_modules`, `dist`, `.nx`, `Dockerfile*`, `docker-compose*`, `.claude`. Or invert
   to an allowlist (`*` + `!apps`, `!libs`, `!package*.json`, …) which fails closed.
4. **Digest-pin every `FROM`** (`node:24.x.y-alpine@sha256:…`) and add Renovate with
   `config:recommended` + `docker:pinDigests` + `helpers:pinGitHubActionDigestsToSemver`
   so digests/tags stay fresh via PRs. (Dependabot maintains existing digests but won't
   add them to tag-only FROM lines.)

### P2 — image hardening

5. **Non-root.** `USER node` in the runtime stage; change NestJS default port to 8080
   (`process.env.PORT ?? 8080`), update compose mappings (`4200:8080`) and
   `healthcheck.js`. `COPY --chown=node:node` only for paths the app must write;
   root-owned read-only app files are fine. (Docker ≥20.10 lets non-root bind 80 via
   `ip_unprivileged_port_start=0`, but that's Docker-specific — don't rely on it.)
6. **`HEALTHCHECK` in the image** (CIS 4.6), exec form so it works shell-less:
   `HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["node", "healthcheck.js"]`
   (K8s ignores it; compose can still override.)
7. **PID 1 / signals.** Node shouldn't be PID 1 — add `init: true` in compose (or bake
   dumb-init). Keep exec-form CMD.
8. **Docs image → `nginxinc/nginx-unprivileged:stable-alpine`** (UID 101, listens 8080,
   rebuilt weekly). `nginx:1.23` is years-EOL. Also switch docs build to `npm ci`.
9. **Misc image-level:** `ENV NODE_ENV=production` (already present — keep, use `=` form),
   OCI labels (`org.opencontainers.image.source` etc.), no secrets ever in ARG/ENV
   (currently true — if a build secret is ever needed, use BuildKit `--mount=type=secret`).

### P3 — compose runtime hardening (shipped defaults)

All zero-user-visible-cost for a plain Node app; this puts the file at the
community-hardened level (better than the Immich/Nextcloud norm, which is just
restart+healthcheck):

```yaml
# no top-level version: (obsolete — Compose v2 ignores it and warns)
services:
  app:
    restart: unless-stopped
    init: true
    read_only: true          # test first; tmpfs covers Node's temp writes
    tmpfs: [/tmp]
    cap_drop: [ALL]          # plain Node server needs no capabilities
    security_opt: [no-new-privileges:true]
    pids_limit: 200
    deploy:
      resources:
        limits:
          memory: 1g
    ports: ['4200:8080']
    healthcheck: { ... existing, pointed at 8080 ... }
```

- Keep default seccomp/AppArmor (don't ship custom profiles; never `unconfined`).
- `user:` in compose becomes optional belt-and-suspenders once `USER node` is in the image.

### P4 — example/production compose + docs guidance

10. **Proxy example:** publish no ports on `app`; shared user-defined network, nginx
    reaches `app:8080` by service name. Pin the proxy image (never `nginx:latest`);
    mount certs `:ro`. `depends_on: { app: { condition: service_healthy } }`.
11. **Docs for self-hosters:** ufw does NOT protect Docker-published ports (still true in
    2026; use `127.0.0.1:4200:8080` bindings or DOCKER-USER chain); never mount
    docker.sock into anything; rootless Docker / Podman notes; `live-restore: true`.
12. **Secrets:** support the `*_FILE` convention (`ONPATIENT_CLIENT_SECRET_FILE` →
    `/run/secrets/...`) in the NestJS config so compose `secrets:` works (plain compose
    supports file-based secrets, no swarm needed); keep `.env` as the documented default
    (`chmod 600`), show the secrets variant in the production example. Env vars leak via
    `docker inspect` / `/proc/<pid>/environ`; file secrets don't.

### P5 — CI / supply chain

13. **SHA-pin all actions** (`uses: docker/build-push-action@<sha> # v6.x.y`) and add
    top-level `permissions: contents: read` to every workflow (widen per-job). Renovate
    keeps pins fresh. Optionally run zizmor on the workflows and add OpenSSF Scorecard.
14. **Attestations:** `sbom: true` on the per-arch build jobs. Provenance stays at
    BuildKit's default `mode=min`, which omits build-arg values; `mode=max` would
    publish them. The push-by-digest → `imagetools create` merge preserves attestations
    on current buildx, but pin `version:` in `docker/setup-buildx-action` (buildx 0.31.1
    briefly broke this exact merge flow — docker/buildx#3708).
15. **Scanning:** Trivy report-only (SARIF → Security tab) after push, plus a weekly
    scheduled scan of `:latest` and a weekly scheduled rebuild so base-image CVE fixes
    reach `latest` without a release. Don't gate releases on CVE counts initially.
16. **Signing:** cosign keyless (GitHub OIDC) on the merged manifest digest — ~10 lines,
    no keys. Docker Hub lacks the OCI 1.1 Referrers API, so cosign falls back to the
    legacy tag scheme; that works, just don't force `--registry-referrers-mode=oci-1-1`.
17. **Docker Hub account:** 2FA + a dedicated Read&Write (not Delete) PAT with expiry
    for the release workflow.

## What was NOT verified hands-on

- Exact current image digests, and whether Mere's native deps build cleanly on Node 24
  (and on musl if staying alpine) — needs a local build.
- That the image tolerates `read_only: true` + `cap_drop: [ALL]` — needs a test run.
- Specific nginx CVE ids / current stable version claims came from web sources, not from
  building; re-check when bumping.

## Key sources

- OWASP Docker Security Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html
- OWASP Node.js Docker Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/NodeJS_Docker_Cheat_Sheet.html
- CIS Docker Benchmark v1.7 — https://rayasec.com/wp-content/uploads/CIS-Benchmark/Docker/CIS_Docker_Benchmark_v1.7_PDF.pdf
- Docker build best practices — https://docs.docker.com/build/building/best-practices/
- Docker attestations in GHA — https://docs.docker.com/build/ci/github-actions/attestations/
- Compose spec (services / deploy / secrets / version) — https://docs.docker.com/reference/compose-file/
- Docker packet filtering & firewalls (ufw bypass) — https://docs.docker.com/engine/network/packet-filtering-firewalls/
- Docker Engine 28 network hardening — https://www.docker.com/blog/docker-engine-28-hardening-container-networking-by-default/
- nodejs/docker-node best practices — https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
- Renovate Docker (pinDigests) — https://docs.renovatebot.com/docker/
- nginx-unprivileged — https://github.com/nginx/docker-nginx-unprivileged
- Distroless — https://github.com/GoogleContainerTools/distroless
- Trivy action — https://github.com/aquasecurity/trivy-action
- Cosign keyless — https://docs.sigstore.dev/cosign/signing/signing_with_containers/
- zizmor — https://github.com/zizmorcore/zizmor
- Docker Hub access tokens — https://docs.docker.com/security/access-tokens/
- Peer projects: Immich compose, Nextcloud AIO compose, Vaultwarden community hardening
