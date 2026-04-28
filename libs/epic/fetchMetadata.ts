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

const fetchMeta = async (item: EndpointItem): Promise<EndpointMeta> => {
  const meta_url = `${item.url}metadata`;
  const res = await (
    await fetch(meta_url, {
      headers: { Accept: 'application/json+fhir' },
    })
  ).json();

  const sec_ext = res?.rest?.[0].security.extension?.[0].extension;
  const pickValueUri = (key: string) =>
    sec_ext?.filter((x: { url: string }) => x.url === key)?.[0]?.valueUri;

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
): Promise<{ results: EndpointMeta[]; failures: Failure[] }> => {
  const batches: EndpointItem[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  const results: EndpointMeta[] = [];
  const failures: Failure[] = [];

  for (const [iter, batch] of batches.entries()) {
    const settled = await Promise.allSettled(batch.map(fetchMeta));

    settled.forEach((s, idx) => {
      if (s.status === 'fulfilled') {
        results.push(s.value);
      } else {
        failures.push({ item: batch[idx], error: s.reason });
      }
    });

    const successCount = settled.filter(
      (s) => s.status === 'fulfilled',
    ).length;
    const errorCount = settled.length - successCount;
    console.log(
      `BATCH ${TerminalColor.bgBlue(`${iter}`)}: Processed ${successCount} of ${batch.length} in batch. ` +
        TerminalColor.red(`${errorCount} error(s) when processing.`),
    );
  }

  return { results, failures };
};

(async () => {
  try {
    const args = process.argv.slice(2);
    const fhirVersion = args.includes('--r4') ? 'R4' : 'DSTU2';

    console.log(`Starting ${fhirVersion} Endpoint Metadata Fetcher for EPIC`);

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

    const data = await fetch(endpointsUrl, {
      headers: { Accept: 'application/json+fhir' },
    }).then((res) => res.json());

    const urls: EndpointItem[] = data?.entry.map((i: any) => ({
      id: i.resource?.id,
      name: i.resource?.name,
      url: i.resource?.address,
      managingOrganization: i.resource?.managingOrganization?.reference,
    }));

    if (!urls || !urls.length) {
      throw new Error('No content found');
    }

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

    if (fhirVersion === 'R4') {
      results.push({
        id: 'sandbox_epic_r4',
        name: 'Epic MyChart Sandbox (R4)',
        url: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/',
        token: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
        authorize:
          'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
      });
    } else {
      results.push({
        id: 'sandbox_epic',
        name: 'Epic MyChart Sandbox',
        url: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/DSTU2/',
        token: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
        authorize:
          'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
      });
    }

    const outputPath =
      fhirVersion === 'R4'
        ? './src/lib/data/R4Endpoints.json'
        : './src/lib/data/DSTU2Endpoints.json';
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    const errorLogPath =
      fhirVersion === 'R4' ? './errorlog-r4.json' : './errorlog-dstu2.json';
    if (failures.length) {
      console.log(
        TerminalColor.red(
          `${failures.length} error(s) remained after ${RETRY_ATTEMPTS} retries. See ${errorLogPath}`,
        ),
      );
      fs.writeFileSync(
        errorLogPath,
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
    } else {
      fs.writeFileSync(errorLogPath, '[]');
    }

    console.log(TerminalColor.green('Done'));
  } catch (e) {
    console.error(e);
  }
})().catch((e) => console.error(e));
