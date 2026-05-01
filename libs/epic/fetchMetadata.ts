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
  const res = await (
    await fetch(meta_url, {
      headers: { Accept: 'application/json+fhir' },
    })
  ).json();

  // Some Epic tenants return OperationOutcome (e.g. "No command was found")
  // or a CapabilityStatement with no SMART security block. They're dead
  // endpoints, not transient failures — skip silently rather than retry.
  if (res?.resourceType === 'OperationOutcome') return null;
  const sec_ext = res?.rest?.[0]?.security?.extension?.[0]?.extension;
  if (!sec_ext) return null;

  const pickValueUri = (key: string) =>
    sec_ext.filter((x: { url: string }) => x.url === key)?.[0]?.valueUri;

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
  skipped: number;
}> => {
  const batches: EndpointItem[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  const results: EndpointMeta[] = [];
  const failures: Failure[] = [];
  let skipped = 0;

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
    skipped += skipCount;

    const errorCount = settled.length - successCount - skipCount;
    console.log(
      `BATCH ${TerminalColor.bgBlue(`${iter}`)}: Processed ${successCount} of ${batch.length} in batch. ` +
        (skipCount ? `${skipCount} skipped. ` : '') +
        TerminalColor.red(`${errorCount} error(s) when processing.`),
    );
  }

  return { results, failures, skipped };
};

(async () => {
  try {
    const args = process.argv.slice(2);
    const fhirVersion = args.includes('--r4')
      ? FHIR_VERSION.R4
      : FHIR_VERSION.DSTU2;

    console.log(`Starting ${fhirVersion} Endpoint Metadata Fetcher for EPIC`);

    const endpointsUrl =
      fhirVersion === FHIR_VERSION.R4
        ? process.env.R4_BRANDS_ENDPOINT_URL
        : process.env.DSTU2_ENDPOINTS_URL;

    if (!endpointsUrl) {
      throw new Error(
        `${fhirVersion}_ENDPOINTS_URL is not defined in environment variables`,
      );
    }
    console.log(`Using URL: ${endpointsUrl}`);

    if (fhirVersion === FHIR_VERSION.DSTU2) {
      getAndProcessDSTU2({ url: endpointsUrl, fhirVersion: fhirVersion });
    } else {
      console.log('Download will start shortly');
      getAndProcessR4({ url: endpointsUrl, fhirVersion: fhirVersion });
    }
  } catch (e) {
    console.error(e);
  }

  /*
   * Get Data Functions/Types
   */
  interface GetDataProps {
    url: string;
    fhirVersion: FhirVersion;
  }

  async function getAndProcessR4(props: GetDataProps): Promise<void> {
    const response = await fetch(props.url, {
      headers: {
        Accept: 'application/json+fhir',
      },
    });

    const rawResponse = await downloadAndDisplayStatus({
      fetchResponse: response,
    });
    const jsonResponse = convertResponseToJson(rawResponse);

    const urls: EndpointItem[] = [];

    (jsonResponse as any)?.entry.forEach((i: any) => {
      // skips resources which are not of type `Endpoint`
      if (i.resource.resourceType !== 'Endpoint') {
        return;
      }

      const dataUrl = i.resource?.address;
      urls.push({
        id: i.resource?.id,
        name: i.resource?.name,
        // most new data does not have a tailing slash
        url:
          dataUrl.endsWith('/') === true
            ? i.resource.address
            : `${i.resource.address}/`,
        // managing organization name moved to `display`
        managingOrganization: i.resource?.managingOrganization?.display,
      });
    });

    if (!urls || !urls.length) {
      throw new Error('No content found');
    }

    processData({ urls: urls, fhirVersion: props.fhirVersion });
  }

  async function getAndProcessDSTU2(props: GetDataProps): Promise<void> {
    const data = await fetch(props.url, {
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

    processData({ urls: urls, fhirVersion: props.fhirVersion });
  }

  /*
   * Process Data Functions/Types
   */
  interface ProcessDataProps {
    urls: EndpointItem[];
    fhirVersion: FhirVersion;
  }

  async function processData(props: ProcessDataProps) {
    const initial = await runBatched(props.urls);
    const results: EndpointMeta[] = [...initial.results];
    let failures: Failure[] = initial.failures;
    let totalSkipped = initial.skipped;

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
      totalSkipped += retry.skipped;
    }

    if (totalSkipped) {
      console.log(
        `Skipped ${totalSkipped} endpoint(s) returning OperationOutcome or no SMART security block`,
      );
    }

    if (props.fhirVersion === FHIR_VERSION.R4) {
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
      props.fhirVersion === FHIR_VERSION.R4
        ? './src/lib/data/R4Endpoints.json'
        : './src/lib/data/DSTU2Endpoints.json';
    const usable = results.filter((r) => r.token && r.authorize);
    const dropped = results.length - usable.length;
    if (dropped) {
      console.log(
        TerminalColor.red(
          `Dropping ${dropped} endpoint(s) missing token/authorize (unusable for SMART login)`,
        ),
      );
    }
    fs.writeFileSync(outputPath, JSON.stringify(usable, null, 2));

    const errorLogPath =
      props.fhirVersion === FHIR_VERSION.R4
        ? './errorlog-r4.json'
        : './errorlog-dstu2.json';
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
  }

  /*
   * Utility Functions/Types
   */
  interface DownloadAndDisplayStatusProps {
    fetchResponse: Response;
  }

  interface DownloadAndDisplayStatusResponse {
    receivedLength: number;
    chunks: Uint8Array<ArrayBuffer>[];
  }

  async function downloadAndDisplayStatus(
    props: DownloadAndDisplayStatusProps,
  ): Promise<DownloadAndDisplayStatusResponse> {
    const reader = props.fetchResponse.body?.getReader();

    if (reader == null) {
      throw new Error('response body was null');
    }

    const contentLengthHeader =
      props.fetchResponse.headers.get('Content-Length');

    if (contentLengthHeader == null) {
      throw new Error('contentLength header was null');
    }

    const contentLength = parseInt(contentLengthHeader);

    let isDone = false;
    let receivedLength = 0;
    const chunks: Array<Uint8Array<ArrayBuffer>> = [];

    while (isDone === false) {
      const { done, value } = await reader.read();
      isDone = done;

      if (isDone === true) {
        console.log('\n');
        break;
      }

      if (value == null) {
        throw new Error('reader value was null or undefined');
      }

      chunks.push(value);
      receivedLength += value.length;

      renderLoadingBar({
        receivedLength: receivedLength,
        contentLength: contentLength,
        barWidth: 20,
      });
    }

    return {
      receivedLength: receivedLength,
      chunks: chunks,
    };
  }

  interface RenderLoadingBarProps {
    receivedLength: number;
    contentLength: number;
    barWidth: number;
  }

  function renderLoadingBar(props: RenderLoadingBarProps): void {
    const percentDone = Math.round(
      (props.receivedLength * 100) / props.contentLength,
    );
    const visualBlockCount = Math.floor((percentDone * props.barWidth) / 100);
    const emptyBlockCount = props.barWidth - visualBlockCount;
    const visualLoadingBarLoaded = '█'.repeat(visualBlockCount);
    const visualLoadingBarRemaining = '░'.repeat(emptyBlockCount);

    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(
      `Downloading [${TerminalColor.green(visualLoadingBarLoaded)}${visualLoadingBarRemaining}] ${percentDone}%`,
    );
  }

  type ConvertResponseToJsonProps = DownloadAndDisplayStatusResponse;

  function convertResponseToJson(props: ConvertResponseToJsonProps): JSON {
    const allChunks = new Uint8Array(props.receivedLength);
    let position = 0;
    for (const chunk of props.chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }
    const decodedResult = new TextDecoder('utf-8').decode(allChunks);
    return JSON.parse(decodedResult);
  }
})().catch((e) => console.error(e));
