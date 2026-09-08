import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger, Module } from '@nestjs/common';
import { TenantDb, openTenantDb } from '@mere/tenant-db';

export const TENANT_DB = 'TENANT_DB';

const PACKAGED = path.join(__dirname, 'assets', 'tenants.db');
const IN_WORKSPACE = path.resolve(
  __dirname,
  '../../../../../libs/tenant-db/data/tenants.db',
);

/**
 * Locates the shipped tenant catalog.
 *
 * The build copies it beside the bundle as an asset; running from the workspace it is
 * still in `libs/tenant-db/data`. Both are found without configuration, so booting the
 * server never depends on an environment variable being set.
 */
function tenantDbPath(): string {
  const override = process.env['MERE_TENANT_DB'];
  if (override) return override;

  const found = [PACKAGED, IN_WORKSPACE].find((candidate) =>
    fs.existsSync(candidate),
  );
  if (!found) {
    throw new Error(
      `No tenant catalog found at ${PACKAGED} or ${IN_WORKSPACE}. Run: nx run emr-pipeline:publish`,
    );
  }
  return found;
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
