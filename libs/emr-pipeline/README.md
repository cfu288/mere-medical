# emr-pipeline

Build-time ETL that turns vendor EMR directories into `libs/tenant-db/data/tenants.db`.

```
vendor APIs / files ──▶ warehouse.db ──▶ tenants.db ──▶ apps/api ──▶ apps/web
     (extract)          (raw+derived,     (committed,    (SQL, FTS)   (frozen HTTP
                         gitignored)       ~13.5 MiB)                  contract)
```

```
nx run emr-pipeline:extract
nx run emr-pipeline:transform
nx run emr-pipeline:publish
nx run emr-pipeline:status
```

Only `extract` fetches tenant EMR data using a network. `transform` and `publish` are
pure functions of `data/warehouse.db`; the artifact never depends on a previous
`tenants.db`. The monthly refresh workflow (`.github/workflows/emr-pipeline.yaml`)
runs all three, opens a PR with the regenerated `tenants.db`, and comments the status
output on it; that human review is the quality gate, not checks inside the pipeline.

Each adapter ships its directory URL as a default, so a bare `extract` crawls every
configured pipeline; `*_ENDPOINTS_URL` variables override them (see `src/adapters/`).
Three variables carry meaning beyond an override:

| variable                    | value                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `EPIC_CLIENT_ID`            | DCR-authorized Epic client id; unlocks per-tenant register urls in metadata                                             |
| `VERADIGM_R4_ENDPOINTS_URL` | no default; `https://open.platform.veradigm.com/fhirendpoints/download/R4?endpointFilter=Patient` turns the R4 crawl on |
| `HEALOW_R4_FILE_LOCATION`   | path to an eCW practice bundle on disk                                                                                  |

Healow reads eClinicalWorks' public practice list by default
(`https://fhir.eclinicalworks.com/ecwopendev/external/practiceList`, ~15 MB, 17,274
practices). Set `HEALOW_R4_FILE_LOCATION` to read a bundle from disk instead, which is
what the vendor libs used to do.

Veradigm's R4 directory lists 21 practice ids on two or three different FHIR base urls.
A tenant id must identify exactly one endpoint, so `transform` drops any id a directory
lists at conflicting urls (and counts it); the other ~1,693 publish normally. The web
app still connects Veradigm over DSTU2 only.

Epic's Brands bundle is ~90 MB and Athena's is ~132 MB, so a run peaks around 1.3 GB of
heap and the directory fetch gets its own multi-minute timeout.

`data/warehouse.db` is gitignored; the workflow persists it as a rolling
`warehouse-backup` release asset. Override paths with `EMR_WAREHOUSE_DB` and
`EMR_TENANT_DB`.

## Data flow

1. **Discover.** Each adapter reads its vendor directory and yields candidate tenants.
   An accepted directory body is saved into `directory_snapshots`, the history that
   remembers every tenant ever listed; a body identical to the newest saved copy only
   updates that copy's date.
2. **Extract.** Fetches the CapabilityStatement of every currently listed tenant, each
   run. Bounded worker pool with a per-host cap and a per-host give-up rule; a failure,
   including a 200 carrying non-JSON, updates error columns only. It **never clobbers a
   good body**: a run killed midway costs a re-crawl, never data.
3. **Transform.** `DELETE` + `INSERT` rebuilds the derived tables by replaying the whole
   snapshot history: every tenant ever listed, its latest url and seen date, its last
   non-empty name, every url it was ever listed at, and a classification of each url's
   stored capability body. Pure, offline.
4. **Publish.** One query over the derived tables writes a fresh `tenants.db`: entries
   joined to their usable capability (preferring the current url, else the most
   recently seen url that still classifies usable), plus code-seeded sandbox rows stamped
   with the newest snapshot time. Publishing twice from the same warehouse yields the
   same artifact.

Failure semantics: **partial failure degrades to staleness, never absence**. Transform
reads the last-known-good body per URL, and a run killed midway publishes what a
completed run over the same bodies would.

Every row carries `last_seen_in_directory` and no row ever leaves the artifact. Nothing
in this repo turns that timestamp into an expiry: search and `findTenantById` serve every
row however old its seen date, so delisted tenants stay reachable and connected users'
sync never breaks. If hiding long-delisted tenants ever matters, that becomes a filter
in the API reading the column, not pipeline state.

## Guardrails

Extract rejects only a directory that contradicts itself: an unparseable body, an empty
yield, or a declared `total` its entries do not match. A rejected directory is never
parsed into the derived tables and advances no seen date.

Publish has no checks of its own: the artifact ships whatever the warehouse holds, and
the monthly PR's status comment is where a human catches a bad refresh.

## Schema

The DDL lives in `src/db/warehouse.sql` (durable), `src/db/derived.sql`
(disposable, dropped and rebuilt), and `libs/tenant-db/src/lib/schema.ts` (the shipped
artifact, `user_version`-asserted at open). `tenants.db` and the derived tables are never
migrated; they regenerate from the durable tables. The durable state is what extract
learns: raw bodies and the snapshot history. Losing the warehouse costs a recrawl plus
the memory of tenants no directory lists anymore.

```mermaid
erDiagram
  raw_documents {
    INTEGER id PK
    TEXT vendor UK
    TEXT fhir_version UK
    TEXT doc_type UK
    TEXT url UK
    TEXT raw
    TEXT last_refreshed
    TEXT last_sync_attempt
  }
  directory_snapshots {
    INTEGER id PK
    TEXT vendor UK
    TEXT fhir_version UK
    TEXT fetched_at UK
    TEXT body
  }
  fetch_runs {
    INTEGER id PK
    TEXT vendor
    TEXT fhir_version
    TEXT status
    INTEGER failed
  }
  directory_counts {
    TEXT vendor PK
    TEXT fhir_version PK
    TEXT seen_at
    INTEGER tenant_count
  }
  publications {
    INTEGER id PK
    TEXT published_at
    INTEGER row_count
  }
  tenant_directory_entries {
    INTEGER id PK
    TEXT vendor UK
    TEXT fhir_version UK
    TEXT tenant_id UK
    TEXT url
    TEXT last_seen_in_directory
  }
  tenant_urls {
    TEXT vendor UK
    TEXT fhir_version UK
    TEXT tenant_id UK
    TEXT url UK
    TEXT last_seen_at
  }
  tenant_capabilities {
    INTEGER id PK
    TEXT vendor UK
    TEXT fhir_version UK
    TEXT url UK
    TEXT classification
  }
  tenants {
    INTEGER id PK
    TEXT vendor UK
    TEXT fhir_version UK
    TEXT tenant_id UK
    TEXT source
    INTEGER searchable
    TEXT last_seen_in_directory
  }
  tenants_fts {
    TEXT name "FTS5, content=tenants"
    TEXT managing_organization "FTS5"
  }

  directory_snapshots ||--o{ tenant_directory_entries : "merge"
  directory_snapshots ||--o{ tenant_urls : "merge"
  raw_documents ||--o{ tenant_capabilities : "classify by url"
  tenants ||--|| tenants_fts : content_rowid
```

How rows move between the tables and across the two databases:

```mermaid
flowchart LR
  subgraph warehouse["warehouse.db"]
    raw[raw_documents]
    snaps[directory_snapshots]
    tde[tenant_directory_entries]
    turl[tenant_urls]
    tc[tenant_capabilities]
    dobs[directory_counts]
  end
  subgraph artifact["tenants.db (shipped)"]
    t[tenants]
    fts[tenants_fts]
  end
  seeds[adapter sandbox seeds]

  snaps -- "transform: merge history" --> tde & turl & dobs
  raw -- "transform: classify" --> tc
  tde -- "publish: one query" --> t
  turl -- "usable url pick" --> t
  tc -- "usable url pick" --> t
  seeds --> t
  t --> fts
```

## Design decisions

| Decision                                  | Why                                                                                                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commit `tenants.db` as a binary           | ~2.7 MB/commit gzipped; Git LFS bills the repo owner and a blocked pull breaks `docker build` with a pointer file. DVC, Dolt, and sqlite-diffable rejected. |
| One raw table, upsert-in-place            | Capability bodies need no version history; only directory bodies do, and those live in `directory_snapshots`.                                               |
| No ORM; free functions + prepared SQL     | The hot query is FTS `MATCH`; bulk upserts and `INSERT…SELECT` are where ORMs are weakest.                                                                  |
| FTS prefix match, no fuzzy fallback       | Typo tolerance traded for ranked ~1.5 ms search; a misspelling returns nothing rather than a guess.                                                         |
| Directory wins FHIR-version disagreements | The URL is version-specific; the server's claim is recorded as data, and a mismatch is a data-quality query.                                                |
| Don't collapse DSTU2/R4 tenant identity   | 1,168 Cerner ids legitimately exist in both versions, so `fhir_version` is part of the tenant key.                                                          |
| Single-instance vendors are not rows      | `tenants` holds rows a user selects between; one-endpoint vendors (VA, OnPatient, NextGen) stay as literals in `fhir-oauth`.                                |
| Retention: keep all raw                   | Pruning before sizes are measured defeats the store's purpose; no `prune` command exists yet.                                                               |
