# Contributing

## Open an issue first

Every change starts as an issue. Open it through one of the [issue forms](https://github.com/cfu288/mere-medical/issues/new/choose). Issues opened any other way are closed automatically. This is mostly so we can discuss potential changes before you spend a lot of time implementing.

## Branches

Name branches `type/subject`, for example `feat/web-dark-mode` or `fix/timeline-banner-avatar`.

## Commits

Write each commit as one line in the form `type(scope): subject`, AKA conventional commits.

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`.
- Scope is the app or library you changed, for example `web`, `api` or `reference-pipeline`.
- The subject says what the change does, in lowercase plain words. For example, `fix(web): give the timeline banner avatar a fixed width`.

Keep each commit to one change. Put fixes you found along the way in their own commit, not mixed into the feature.

## Pull requests

- Use the same `type(scope): subject` form for the title. PRs are squash merged, so the title becomes the commit on `main`.
- Include tests for the fix or feature. If a change cannot be tested, say why in the PR.

## AI policy

AI-assisted coding is welcome, but you own the work. Only submit code you understand and can explain.

- Never let an LLM speak for you. Write issues, PR descriptions and review replies in your own words.
- Never let an LLM think for you. You make the design decisions.
- Do not add AI attribution, such as a `Co-authored-by` trailer naming an AI agent, to commits or PRs. Like previously mentioned, you own the work, tool use is irrelevant.

AI slop PRs will be rejected.
