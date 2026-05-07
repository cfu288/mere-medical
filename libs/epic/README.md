# epic

This library was generated with [Nx](https://nx.dev).

## Fetching updated metadata

Copy `.env.example` to `.env` (the values default to Epic's public endpoint listings), then run:

```
npm install
npm run fetch-endpoints           # both DSTU2 and R4
npm run fetch-endpoints:dstu2     # DSTU2 only
npm run fetch-endpoints:r4        # R4 only
```

Endpoints can be found from the [Epic Endpoints Guide](https://open.epic.com/MyApps/Endpoints)

The endpoint bundles (R4 and DSTU2) which were previously used have since been deprecated and are no longer updated. Use `R4_BRANDS_ENDPOINT_URL` moving forward.

DSTU2 is read from `DSTU2_ENDPOINTS_URL` and written to `src/lib/data/DSTU2Endpoints.json`; R4 is read from `R4_BRANDS_ENDPOINT_URL` and written to `src/lib/data/R4Endpoints.json`. Failures are retried up to 3 times with exponential backoff; anything still failing afterward lands in `errorlog-dstu2.json` or `errorlog-r4.json` with the item details and serialized error.

## Building

Run `nx build epic` to build the library.

## Running unit tests

Run `nx test epic` to execute the unit tests via [Jest](https://jestjs.io).
