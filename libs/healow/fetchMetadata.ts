import * as fs from 'fs';
import 'dotenv/config';

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
  managingOrganization?: string;
}

(async () => {
  try {
    console.log('Starting R4 Endpoint Metadata Fetcher for HEALOW');

    const fileLocation = process.env.R4_FILE_LOCATION;
    if (!fileLocation) {
      throw new Error('R4_FILE_LOCATION is not set');
    }

    console.log(`Using file: ${fileLocation}`);

    const data = JSON.parse(fs.readFileSync(fileLocation, 'utf8'));

    const endpointsMap = new Map<string, ProcessedEndpoint>();

    data?.entry?.forEach((entry: any) => {
      const resource = entry.resource;
      if (!resource?.id) return;

      const id = resource.id;
      const existing = endpointsMap.get(id);

      if (resource.resourceType === 'Endpoint') {
        endpointsMap.set(id, {
          id,
          name: resource.name || existing?.name || '',
          url: resource.address || existing?.url || '',
          managingOrganization: `Organization/${id}`,
        });
      } else if (resource.resourceType === 'Organization' && existing) {
        endpointsMap.set(id, {
          ...existing,
          name: resource.name || existing.name,
        });
      }
    });

    const endpoints = Array.from(endpointsMap.values()).filter(
      (e) => e.url && typeof e.url === 'string',
    );

    if (!endpoints.length) {
      throw new Error('No endpoints found');
    }

    console.log(`Found ${endpoints.length} R4 endpoints`);

    const fetchMeta = async (
      endpoint: ProcessedEndpoint,
    ): Promise<ProcessedEndpoint> => {
      const metaUrl = endpoint.url.endsWith('/')
        ? `${endpoint.url}metadata`
        : `${endpoint.url}/metadata`;

      try {
        const res = await fetch(metaUrl, {
          headers: { Accept: 'application/json+fhir' },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const metadata = await res.json();
        const secExt = metadata?.rest?.[0]?.security?.extension?.[0]?.extension;

        if (secExt) {
          endpoint.token = secExt.find(
            (x: any) => x.url === 'token',
          )?.valueUri;
          endpoint.authorize = secExt.find(
            (x: any) => x.url === 'authorize',
          )?.valueUri;
        }

        console.log(`✓ ${metaUrl}`);
        return endpoint;
      } catch (error) {
        console.log(`✗ ${metaUrl} - ${error}`);
        throw error;
      }
    };

    const batchSize = 10;
    const results: ProcessedEndpoint[] = [];
    const errors: any[] = [];

    for (let i = 0; i < endpoints.length; i += batchSize) {
      const batch = endpoints.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      console.log(
        `\nProcessing batch ${TerminalColor.bgBlue(`${batchNum}`)} (${batch.length} endpoints)`,
      );

      const batchResults = await Promise.allSettled(batch.map(fetchMeta));

      const successful = batchResults
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as PromiseFulfilledResult<ProcessedEndpoint>).value);

      const failed = batchResults
        .filter((r) => r.status === 'rejected')
        .map((r, idx) => ({
          endpoint: batch[idx],
          error: (r as PromiseRejectedResult).reason?.message,
        }));

      results.push(...successful);
      errors.push(...failed);

      console.log(
        `Batch ${TerminalColor.bgBlue(`${batchNum}`)}: ` +
          `${TerminalColor.green(`${successful.length} successful`)}, ` +
          `${TerminalColor.red(`${failed.length} failed`)}`,
      );
    }

    results.push({
      id: 'sandbox_healow',
      name: 'Healow Sandbox (eClinicalWorks)',
      url: 'https://fhir4.healow.com/fhir/r4/JAFJCD',
      token: 'https://oauthserver.eclinicalworks.com/oauth/oauth2/token',
      authorize:
        'https://oauthserver.eclinicalworks.com/oauth/oauth2/authorize',
      managingOrganization: 'Organization/JAFJCD',
    });

    const outputPath = './src/lib/data/R4Endpoints.json';
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    console.log(`\n${TerminalColor.green('✓ Success!')}`);
    console.log(`Saved ${results.length} endpoints to ${outputPath}`);

    if (errors.length > 0) {
      fs.writeFileSync('./errorlog.json', JSON.stringify(errors, null, 2));
      console.log(
        TerminalColor.red(
          `${errors.length} error(s) occurred. Details saved to errorlog.json`,
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
