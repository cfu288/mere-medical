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

const ENDPOINTS_URL =
  process.env['R4_ENDPOINTS_URL'] ??
  'https://open.platform.veradigm.com/fhirendpoints/download/R4?endpointFilter=Patient';

/**
 * Fetches the Veradigm R4 patient endpoint directory
 * (https://developer.veradigm.com/Fhir → Endpoint Directory) and each
 * endpoint's CapabilityStatement to extract its OAuth URLs.
 */
(async () => {
  try {
    console.log('Starting R4 Endpoint Metadata Fetcher for VERADIGM');
    console.log(`Using URL: ${ENDPOINTS_URL}`);

    const data = await fetch(ENDPOINTS_URL, {
      headers: {
        Accept: 'application/fhir+json',
      },
      signal: AbortSignal.timeout(120_000),
    }).then((res) => res.json());

    let urls: {
      id: string;
      name: string;
      url: string;
    }[] = data?.entry
      .filter((i: any) => i.resource?.resourceType === 'Endpoint')
      .map((i: any) => {
        return {
          id: i.resource.id,
          name: i.resource.contained?.[0]?.name ?? i.resource.name,
          url: i.resource?.address,
        };
      });

    urls = urls.reduce((acc, current) => {
      const x = acc.find((item) => item.url === current.url);
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, [] as any[]);

    if (!urls || !urls.length) {
      throw new Error('No content found');
    }

    console.log(`Found ${urls.length} endpoints`);

    const fetchMeta = async (item: {
      id: string;
      name: string;
      url: string;
    }) => {
      const meta_url = `${item.url}/metadata`;
      const res = await (
        await fetch(meta_url, {
          headers: {
            // Versionless endpoints default to DSTU2: developer.veradigm.com/Fhir/EndpointDirectory
            Accept: 'application/fhir+json; fhirVersion=4.0',
          },
          signal: AbortSignal.timeout(30_000),
        })
      ).json();

      const sec_ext = res?.rest?.[0].security.extension?.[0].extension,
        token = sec_ext?.filter(
          (x: { url: string & Location }) => x.url === 'token',
        )?.[0]?.valueUri,
        authorize = sec_ext?.filter(
          (x: { url: string & Location }) => x.url === 'authorize',
        )?.[0]?.valueUri,
        introspect = sec_ext?.filter(
          (x: { url: string & Location }) => x.url === 'introspect',
        )?.[0]?.valueUri,
        manage = sec_ext?.filter(
          (x: { url: string & Location }) => x.url === 'manage',
        )?.[0]?.valueUri;

      if (!token && !authorize) {
        throw new Error(
          `No token and authorize endpoint found for ${meta_url}`,
        );
      } else if (!token) {
        throw new Error(`No token endpoint found for ${meta_url}`);
      } else if (!authorize) {
        throw new Error(`No authorize endpoint found for ${meta_url}`);
      }

      console.log('- ' + meta_url);
      return {
        url: item.url?.endsWith('/') ? item.url : item.url + '/',
        id: item.id,
        name: item.name,
        token: token ? (token?.endsWith('/') ? token : token + '/') : undefined,
        authorize: authorize
          ? authorize?.endsWith('/')
            ? authorize
            : authorize + '/'
          : undefined,
        introspect: introspect
          ? introspect?.endsWith('/')
            ? introspect
            : introspect + '/'
          : undefined,
        manage: manage
          ? manage?.endsWith('/')
            ? manage
            : manage + '/'
          : undefined,
      };
    };

    try {
      const batches: {
        id: string;
        name: string;
        url: string;
        token?: string;
        authorize?: string;
      }[][] = [];
      const batchSize = 10;
      for (let i = 0; i < urls.length; i += batchSize) {
        batches.push(urls.slice(i, i + batchSize));
      }

      const results: any[] = [];
      const errors: any[] = [];
      for (const [iter, batch] of batches.entries()) {
        const metaPromises = batch.map(fetchMeta);
        const res = await Promise.allSettled(metaPromises);

        const successRes = res
          .filter((i) => i.status === 'fulfilled')
          .map((i) => (i as PromiseFulfilledResult<any>).value);
        const errorsRes = res
          .filter((i) => i.status === 'rejected')
          .map((i) => (i as PromiseRejectedResult).reason);
        errorsRes.forEach((e) => console.error(e));

        results.push(...successRes);
        console.log(
          `BATCH ${TerminalColor.bgBlue(`${iter}`)}: Processed ${
            successRes.length
          } of ${batch.length} in batch. ` +
            TerminalColor.red(`${errorsRes.length} error(s) when processing.`),
        );
        errors.push(...errorsRes);
      }

      results.push({
        id: 'sandbox_veradigm',
        name: 'Veradigm Sandbox',
        url: 'https://fhir.fhirpoint.open.allscripts.com/fhirroute/open/CP00101/',
        token:
          'https://open.allscripts.com/fhirroute/patientauthv2/afdc1f7b-b362-4777-8ab3-83472abd0b8a/connect/token/',
        authorize:
          'https://open.allscripts.com/fhirroute/patientauthv2/afdc1f7b-b362-4777-8ab3-83472abd0b8a/connect/authorize/',
      });

      fs.writeFileSync(
        './src/lib/data/R4Endpoints.json',
        JSON.stringify(results, null, 2),
      );

      if (errors.length) {
        console.log(
          TerminalColor.red(
            `${errors.length} error(s) when processing. Check the errorlog for more details`,
          ),
        );
        fs.writeFileSync('./errorlog.json', JSON.stringify(errors));
      }
    } catch (e) {
      console.error(e);
    }
    console.log(TerminalColor.green('Done'));
  } catch (e) {
    console.error(e);
  }
})();
