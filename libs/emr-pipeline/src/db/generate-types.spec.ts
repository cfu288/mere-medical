import * as fs from 'node:fs';
import * as path from 'node:path';
import { tenantDbSchemaSource, warehouseSchemaSource } from './generate-types';

describe('generated schema files', () => {
  it('warehouse-schema.ts matches the warehouse ddl', () => {
    expect(
      fs.readFileSync(path.join(__dirname, 'warehouse-schema.ts'), 'utf8'),
    ).toBe(warehouseSchemaSource());
  });

  it('tenant-db-schema.ts matches the artifact ddl', () => {
    expect(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../tenant-db/src/lib/tenant-db-schema.ts',
        ),
        'utf8',
      ),
    ).toBe(tenantDbSchemaSource());
  });
});
