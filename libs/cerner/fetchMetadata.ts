import * as fs from 'fs';
import 'dotenv/config';
import type {
  Bundle as R4Bundle,
  Endpoint as R4Endpoint,
  Organization as R4Organization,
} from 'fhir/r4';
import type { Bundle as DSTU2Bundle } from 'fhir/r2';

class TerminalColor {
  static readonly BgBlue = '\x1b[44m';
  static readonly Green = '\x1b[32m';
  static readonly Red = '\x1b[31m';
  static readonly Reset = '\x1b[0m';

  static bgBlue = (str: string) =>
    `${TerminalColor.BgBlue}${str}${TerminalColor.Reset}`;
  static green = (str: string) =>
    `${TerminalColor.Green}${str}${TerminalColor.Reset}`;
  static red = (str: string) =>
    `${TerminalColor.Red}${str}${TerminalColor.Reset}`;
}

interface ProcessedEndpoint {
  id: string;
  name: string;
  url: string;
  token?: string;
  authorize?: string;
  introspect?: string;
  manage?: string;
  managingOrganization?: string;
}

(async () => {
  try {
    // Parse command line arguments to determine which version to fetch
    const args = process.argv.slice(2);
    const fhirVersion = args.includes('--r4') ? 'R4' : 'DSTU2';

    console.log(`Starting ${fhirVersion} Endpoint Metadata Fetcher for Cerner`);

    // Select the appropriate URL based on version
    const endpointsUrl =
      fhirVersion === 'R4'
        ? process.env.R4_ENDPOINTS_URL
        : process.env.DSTU2_ENDPOINTS_URL;

    if (!endpointsUrl) {
      throw new Error(
        `${fhirVersion}_ENDPOINTS_URL is not defined in environment variables`,
      );
    }
    console.log(`Using URL: ${endpointsUrl}`);

    // Fetch the list of Cerner endpoints (from GitHub raw JSON)
    const response = await fetch(endpointsUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch endpoints: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    // Extract endpoint information from the bundle
    // R4 has separate Endpoint and Organization entries, DSTU2 has contained resources
    let endpoints: ProcessedEndpoint[] = [];

    if (fhirVersion === 'R4') {
      const r4Bundle = data as R4Bundle;

      // For R4, create a map of organizations first
      const organizations = new Map<string, R4Organization>();
      r4Bundle?.entry?.forEach((entry) => {
        if (entry.resource?.resourceType === 'Organization') {
          const org = entry.resource as R4Organization;
          if (org.id) {
            organizations.set(org.id, org);
          }
        }
      });

      // Then process endpoints
      endpoints =
        r4Bundle?.entry
          ?.filter((entry) => entry.resource?.resourceType === 'Endpoint')
          ?.map((entry) => {
            const endpoint = entry.resource as R4Endpoint;
            const orgId = endpoint.id?.replace('-', 'O-'); // Organization IDs are prefixed with O-
            const organization = organizations.get(orgId!);

            return {
              id: endpoint.id || '',
              name: organization?.name || 'Unknown',
              url: endpoint.address || '',
              managingOrganization: orgId,
            };
          }) || [];
    } else {
      const dstu2Bundle = data as DSTU2Bundle;

      // For DSTU2, use the contained resources structure
      endpoints =
        dstu2Bundle?.entry?.map((entry) => {
          const endpoint = entry.resource as any; // DSTU2 doesn't export Endpoint type
          const organization = endpoint.contained?.[0] as any; // DSTU2 Organization in contained

          return {
            id: endpoint.id || '',
            name: organization?.name || 'Unknown',
            url: endpoint.address || '',
            managingOrganization: endpoint.managingOrganization?.reference,
          };
        }) || [];
    }

    if (!endpoints.length) {
      throw new Error('No endpoints found in the response');
    }

    console.log(
      `Found ${endpoints.length} ${fhirVersion} endpoints to process`,
    );

    // Fetch metadata for each endpoint
    const fetchMetadata = async (
      endpoint: ProcessedEndpoint,
    ): Promise<ProcessedEndpoint> => {
      const metadataUrl = `${endpoint.url}metadata`;

      try {
        const metaResponse = await fetch(metadataUrl, {
          headers: {
            Accept: 'application/json+fhir',
          },
        });

        if (!metaResponse.ok) {
          throw new Error(`HTTP ${metaResponse.status}`);
        }

        const metadata = await metaResponse.json();

        // Extract OAuth URLs from the metadata
        const securityExtensions =
          metadata?.rest?.[0]?.security?.extension?.[0]?.extension;

        if (securityExtensions) {
          const findExtension = (urlType: string) =>
            securityExtensions.find((ext: any) => ext.url === urlType)
              ?.valueUri;

          endpoint.token = findExtension('token');
          endpoint.authorize = findExtension('authorize');
          endpoint.introspect = findExtension('introspect');
          endpoint.manage = findExtension('manage');
        }

        console.log(`✓ ${metadataUrl}`);
        return endpoint;
      } catch (error) {
        console.log(`✗ ${metadataUrl} - ${error}`);
        throw error;
      }
    };

    // Process endpoints in batches
    const batchSize = 10;
    const results: ProcessedEndpoint[] = [];
    const errors: any[] = [];

    for (let i = 0; i < endpoints.length; i += batchSize) {
      const batch = endpoints.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(
        `\nProcessing batch ${TerminalColor.bgBlue(`${batchNumber}`)} (${batch.length} endpoints)`,
      );

      const metadataPromises = batch.map(fetchMetadata);
      const batchResults = await Promise.allSettled(metadataPromises);

      const successful = batchResults
        .filter((result) => result.status === 'fulfilled')
        .map(
          (result) =>
            (result as PromiseFulfilledResult<ProcessedEndpoint>).value,
        );

      const failed = batchResults
        .filter((result) => result.status === 'rejected')
        .map((result, index) => ({
          endpoint: batch[index],
          error: (result as PromiseRejectedResult).reason,
        }));

      results.push(...successful);
      errors.push(...failed);

      console.log(
        `Batch ${TerminalColor.bgBlue(`${batchNumber}`)}: ` +
          `${TerminalColor.green(`${successful.length} successful`)}, ` +
          `${TerminalColor.red(`${failed.length} failed`)}`,
      );
    }

    // Add Cerner sandbox endpoint based on version
    if (fhirVersion === 'R4') {
      results.push({
        id: 'sandbox_cerner_r4',
        name: 'Cerner Sandbox (R4)',
        url: 'https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/',
        token:
          'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token',
        authorize:
          'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
      });
    } else {
      results.push({
        id: 'sandbox_cerner',
        name: 'Cerner Sandbox',
        url: 'https://fhir-myrecord.cerner.com/dstu2/ec2458f2-1e24-41c8-b71b-0e701af7583d/',
        token:
          'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token',
        authorize:
          'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
      });
    }

    // Save results to version-specific file
    const outputPath =
      fhirVersion === 'R4'
        ? './src/lib/data/R4Endpoints.json'
        : './src/lib/data/DSTU2Endpoints.json';

    // Ensure the data directory exists
    const dataDir = './src/lib/data';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    console.log(`\n${TerminalColor.green('✓ Success!')}`);
    console.log(`Saved ${results.length} endpoints to ${outputPath}`);

    // Save error log if there were any errors
    if (errors.length > 0) {
      const errorLogPath =
        fhirVersion === 'R4' ? './errorlog-r4.json' : './errorlog-dstu2.json';
      fs.writeFileSync(errorLogPath, JSON.stringify(errors, null, 2));
      console.log(
        TerminalColor.red(
          `${errors.length} error(s) occurred. Details saved to ${errorLogPath}`,
        ),
      );
    }
  } catch (error) {
    console.error(TerminalColor.red('Fatal error:'), error);
    process.exit(1);
  }
})().catch((error) => {
  console.error(TerminalColor.red('Unhandled error:'), error);
  process.exit(1);
});
