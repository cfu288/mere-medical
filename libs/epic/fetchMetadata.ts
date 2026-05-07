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

const FHIR_VERSION = {
  DSTU2: 'DSTU2',
  R4: 'R4',
} as const;
type FhirVersion = (typeof FHIR_VERSION)[keyof typeof FHIR_VERSION];

type EndpointItem = {
  id: string;
  name: string;
  url: string;
  managingOrganization: string;
};

type EndpointMeta = {
  id: string;
  name: string;
  url: string;
  token?: string;
  authorize?: string;
  introspect?: string;
  manage?: string;
  managingOrganization?: string;
};

type Failure = { item: EndpointItem; error: unknown };

type VersionConfig = {
  envVar: 'R4_BRANDS_ENDPOINT_URL' | 'DSTU2_ENDPOINTS_URL';
  outputPath: string;
  errorLogPath: string;
  sandbox: EndpointMeta;
};

const VERSION_CONFIG: Record<FhirVersion, VersionConfig> = {
  R4: {
    envVar: 'R4_BRANDS_ENDPOINT_URL',
    outputPath: './src/lib/data/R4Endpoints.json',
    errorLogPath: './errorlog-r4.json',
    sandbox: {
      id: 'sandbox_epic_r4',
      name: 'Epic MyChart Sandbox (R4)',
      url: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/',
      token: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      authorize:
        'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    },
  },
  DSTU2: {
    envVar: 'DSTU2_ENDPOINTS_URL',
    outputPath: './src/lib/data/DSTU2Endpoints.json',
    errorLogPath: './errorlog-dstu2.json',
    sandbox: {
      id: 'sandbox_epic',
      name: 'Epic MyChart Sandbox',
      url: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/DSTU2/',
      token: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      authorize:
        'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    },
  },
};

const BATCH_SIZE = 10;
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return error;
};

const fetchMeta = async (item: EndpointItem): Promise<EndpointMeta | null> => {
  const meta_url = `${item.url}metadata`;
  const res = await fetch(meta_url, {
    headers: { Accept: 'application/json+fhir' },
  }).then((r) => r.json());

  // Some Epic tenants return OperationOutcome (e.g. "No command was found")
  // or a CapabilityStatement with no SMART security block. We assume these are
  // dead endpoints and skip rather than retry
  if (res?.resourceType === 'OperationOutcome') return null;
  const sec_ext = res?.rest?.[0]?.security?.extension?.[0]?.extension;
  if (!sec_ext) return null;

  const pickValueUri = (key: string) =>
    sec_ext.find((x: { url: string }) => x.url === key)?.valueUri;

  console.log('- ' + meta_url);
  return {
    url: item.url,
    id: item.id,
    name: item.name,
    token: pickValueUri('token'),
    authorize: pickValueUri('authorize'),
    introspect: pickValueUri('introspect'),
    manage: pickValueUri('manage'),
    managingOrganization: item.managingOrganization,
  };
};

const runBatched = async (
  items: EndpointItem[],
): Promise<{
  results: EndpointMeta[];
  failures: Failure[];
}> => {
  const batches: EndpointItem[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  const results: EndpointMeta[] = [];
  const failures: Failure[] = [];

  for (const [iter, batch] of batches.entries()) {
    const settled = await Promise.allSettled(batch.map(fetchMeta));

    let successCount = 0;
    let skipCount = 0;
    settled.forEach((s, idx) => {
      if (s.status === 'fulfilled') {
        if (s.value === null) {
          skipCount++;
        } else {
          results.push(s.value);
          successCount++;
        }
      } else {
        failures.push({ item: batch[idx], error: s.reason });
      }
    });

    const errorCount = settled.length - successCount - skipCount;
    console.log(
      `BATCH ${TerminalColor.bgBlue(`${iter}`)}: Processed ${successCount} of ${batch.length} in batch. ` +
        (skipCount ? `${skipCount} skipped. ` : '') +
        TerminalColor.red(`${errorCount} error(s) when processing.`),
    );
  }

  return { results, failures };
};

async function fetchR4Endpoints(url: string): Promise<EndpointItem[]> {
  const data = await fetch(url, {
    headers: { Accept: 'application/json+fhir' },
  }).then((r) => r.json());

  const items: EndpointItem[] = [];
  for (const i of data?.entry ?? []) {
    if (i.resource?.resourceType !== 'Endpoint') continue;
    const address: string | undefined = i.resource?.address;
    if (!address) continue;
    items.push({
      id: i.resource.id,
      name: i.resource.name,
      url: address.endsWith('/') ? address : `${address}/`,
      managingOrganization: i.resource.managingOrganization?.display,
    });
  }
  return items;
}

async function fetchDSTU2Endpoints(url: string): Promise<EndpointItem[]> {
  const data = await fetch(url, {
    headers: { Accept: 'application/json+fhir' },
  }).then((r) => r.json());

  const items: EndpointItem[] = [];
  for (const i of data?.entry ?? []) {
    items.push({
      id: i.resource?.id,
      name: i.resource?.name,
      url: i.resource?.address,
      managingOrganization: i.resource?.managingOrganization?.reference,
    });
  }
  return items;
}

async function processData(
  urls: EndpointItem[],
  fhirVersion: FhirVersion,
): Promise<void> {
  const config = VERSION_CONFIG[fhirVersion];

  const initial = await runBatched(urls);
  const results: EndpointMeta[] = [...initial.results];
  let failures: Failure[] = initial.failures;

  for (
    let attempt = 1;
    attempt <= RETRY_ATTEMPTS && failures.length;
    attempt++
  ) {
    const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
    console.log(
      TerminalColor.bgBlue(
        `RETRY ${attempt}/${RETRY_ATTEMPTS}: ${failures.length} item(s) after ${delay}ms`,
      ),
    );
    await sleep(delay);
    const retry = await runBatched(failures.map((f) => f.item));
    results.push(...retry.results);
    failures = retry.failures;
  }

  const totalSkipped = urls.length - results.length - failures.length;
  if (totalSkipped) {
    console.log(
      `Skipped ${totalSkipped} endpoint(s) returning OperationOutcome or no SMART security block`,
    );
  }

  results.push(config.sandbox);

  const usable = results.filter((r) => r.token && r.authorize);
  const dropped = results.length - usable.length;
  if (dropped) {
    console.log(
      TerminalColor.red(
        `Dropping ${dropped} endpoint(s) missing token/authorize (unusable for SMART login)`,
      ),
    );
  }
  fs.writeFileSync(config.outputPath, JSON.stringify(usable, null, 2));

  if (failures.length) {
    console.log(
      TerminalColor.red(
        `${failures.length} error(s) remained after ${RETRY_ATTEMPTS} retries. See ${config.errorLogPath}`,
      ),
    );
  }
  fs.writeFileSync(
    config.errorLogPath,
    JSON.stringify(
      failures.map((f) => ({
        id: f.item.id,
        name: f.item.name,
        url: f.item.url,
        managingOrganization: f.item.managingOrganization,
        error: serializeError(f.error),
      })),
      null,
      2,
    ),
  );

  console.log(TerminalColor.green('Done'));
}

(async () => {
  try {
    const args = process.argv.slice(2);
    const fhirVersion = args.includes('--r4')
      ? FHIR_VERSION.R4
      : FHIR_VERSION.DSTU2;
    const config = VERSION_CONFIG[fhirVersion];

    console.log(`Starting ${fhirVersion} Endpoint Metadata Fetcher for EPIC`);

    const endpointsUrl = process.env[config.envVar];
    if (!endpointsUrl) {
      throw new Error(
        `${config.envVar} is not defined in environment variables`,
      );
    }
    console.log(`Using URL: ${endpointsUrl}`);

    const urls =
      fhirVersion === FHIR_VERSION.R4
        ? await fetchR4Endpoints(endpointsUrl)
        : await fetchDSTU2Endpoints(endpointsUrl);

    if (!urls.length) throw new Error('No content found');

    await processData(urls, fhirVersion);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
})();