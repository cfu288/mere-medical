import * as path from 'node:path';
import type { FhirVersion, Vendor } from '@mere/shared';
import { adapterFor, ADAPTERS } from './adapters';
import { openWarehouse } from './db/open';
import { extract } from './stages/extract';
import { publish } from './stages/publish';
import { formatStatus } from './stages/status';
import { transform } from './stages/transform';

const LIB_ROOT = path.resolve(__dirname, '..');

const DEFAULT_WAREHOUSE = path.join(LIB_ROOT, 'data', 'warehouse.db');
const DEFAULT_ARTIFACT = path.resolve(
  LIB_ROOT,
  '..',
  'tenant-db',
  'data',
  'tenants.db',
);

/** Every vendor and version any adapter declares. Transform walks them all because saved history can exist even where fetching is not configured. */
function targets(): { vendor: Vendor; fhirVersion: FhirVersion }[] {
  return (Object.keys(ADAPTERS) as Vendor[]).flatMap((vendor) =>
    adapterFor(vendor).versions.map((fhirVersion) => ({ vendor, fhirVersion })),
  );
}

/** Only the targets whose directory location is configured. Extract fetches these and logs the ones it skips. */
function configuredTargets(): { vendor: Vendor; fhirVersion: FhirVersion }[] {
  return targets().filter((target) => {
    if (adapterFor(target.vendor).directory(target.fhirVersion)) return true;
    log(
      `${target.vendor} ${target.fhirVersion}: no directory configured, skipping`,
    );
    return false;
  });
}

const now = () => new Date().toISOString();
const log = (message: string) => console.log(message);

/** Runs one pipeline command against the warehouse and returns the exit code. */
async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (rest.length > 0) {
    console.error(`Usage: cli.ts <extract|transform|publish|status>`);
    return 2;
  }
  const db = openWarehouse(DEFAULT_WAREHOUSE);

  try {
    switch (command) {
      case 'extract': {
        let failed = false;
        for (const target of configuredTargets()) {
          try {
            const result = await extract(db, { ...target, now, log });
            if (result.status === 'failed') failed = true;
          } catch (error) {
            failed = true;
            log(
              `${target.vendor} ${target.fhirVersion}: extract crashed - ${error}`,
            );
          }
        }
        return failed ? 1 : 0;
      }
      case 'transform': {
        for (const target of targets()) {
          transform(db, { ...target, log });
        }
        return 0;
      }
      case 'publish': {
        publish(db, { artifactPath: DEFAULT_ARTIFACT, now, log });
        return 0;
      }
      case 'status': {
        console.log(formatStatus(db, now()));
        return 0;
      }
      default:
        console.error(`Usage: cli.ts <extract|transform|publish|status>`);
        return 2;
    }
  } finally {
    db.close();
  }
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
