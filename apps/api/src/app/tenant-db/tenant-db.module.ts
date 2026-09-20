import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger, Module } from '@nestjs/common';
import { TenantDb, openTenantDb } from '@mere/tenant-db';

export const TENANT_DB = 'TENANT_DB';

/** The build copies the shipped tenant catalog beside the bundle as an asset. */
const CATALOG_PATH = path.join(__dirname, 'assets', 'tenants.db');

function tenantDbPath(): string {
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error(
      `No tenant catalog found at ${CATALOG_PATH}. Run: nx run api:build`,
    );
  }
  return CATALOG_PATH;
}

const tenantDbProvider = {
  provide: TENANT_DB,
  useFactory: (): TenantDb => {
    const dbPath = tenantDbPath();
    const db = openTenantDb(dbPath);
    Logger.log(`Tenant catalog loaded from ${dbPath}`);
    return db;
  },
};

@Module({
  providers: [tenantDbProvider],
  exports: [TENANT_DB],
})
export class TenantDbModule {}
