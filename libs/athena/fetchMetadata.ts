import * as fs from 'fs';
import type { Bundle as R4Bundle, Organization as R4Organization } from 'fhir/r4';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const BUNDLE_URL = 'https://service-base-urls.api.fhir.athena.io/athena-fhir-service-base-urls.json';

(async () => {
  try {
    console.log('Starting Athena Organization Metadata Fetcher');
    console.log(`Fetching from: ${BUNDLE_URL}`);

    const response = await fetch(BUNDLE_URL, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch bundle: ${response.status} ${response.statusText}`,
      );
    }

    const bundle = (await response.json()) as R4Bundle;

    const practiceNameMap: Record<string, string> = {};
    let orgCount = 0;

    for (const entry of bundle?.entry ?? []) {
      if (entry.resource?.resourceType !== 'Organization') continue;

      const org = entry.resource as R4Organization;
      const practiceExt = org.extension?.find(
        (ext) =>
          ext.url ===
          'https://fhir.athena.io/StructureDefinition/ah-practice',
      );

      const practiceId =
        practiceExt?.valueReference?.reference?.split('Practice-')[1];

      if (practiceId && org.name) {
        practiceNameMap[practiceId] = org.name;
        orgCount++;
      }
    }

    if (orgCount === 0) {
      throw new Error('No organizations found in the bundle');
    }

    console.log(`${GREEN}Found ${orgCount} organizations${RESET}`);

    const dataDir = './src/lib/data';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const outputPath = './src/lib/data/Organizations.json';
    fs.writeFileSync(outputPath, JSON.stringify(practiceNameMap));

    const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(0);
    console.log(`\n${GREEN}✓ Success!${RESET}`);
    console.log(`Saved ${orgCount} organizations to ${outputPath} (${sizeKB} KB)`);
  } catch (error) {
    console.error(`${RED}Fatal error:${RESET}`, error);
    process.exit(1);
  }
})().catch((error) => {
  console.error(`${RED}Unhandled error:${RESET}`, error);
  process.exit(1);
});
