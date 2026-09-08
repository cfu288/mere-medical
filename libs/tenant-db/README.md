# tenant-db

Read API over `data/tenants.db`, the tenant catalog `apps/api` ships and serves.

```ts
const db = openTenantDb(path);
searchTenants(db, 'saint joseph', { vendors: ['epic'] });
findTenantById(db, 'cerner', tenantId);
```

`openTenantDb` asserts the artifact's schema version and that it holds rows, so a stale
or truncated file fails at boot rather than returning empty search results.

The artifact is written by `emr-pipeline`; this library never writes it.
