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
      headers: {
        Accept: 'application/json+fhir',
      },
    }).then((res) => res.json());

    const urls: {
      id: string;
      name: string;
      url: string;
      managingOrganization: string;
    }[] = data?.entry.map((i: any) => {
      return {
        id: i.resource?.id,
        name: i.resource?.name,
        url: i.resource?.address,
        managingOrganization: i.resource?.managingOrganization?.reference,
      };
    });

    if (!urls || !urls.length) {
      throw new Error('No content found');
    }

    const fetchMeta = async (item: {
      id: string;
      name: string;
      url: string;
      managingOrganization: string;
    }) => {
      const meta_url = `${item.url}metadata`;
      const res = await (
        await fetch(meta_url, {
          headers: {
            Accept: 'application/json+fhir',
          },
        })
      ).json();

      const sec_ext = res?.rest?.[0].security.extension?.[0].extension,
        token = sec_ext.filter(
          (x: { url: string & Location }) => x.url === 'token',
        )?.[0]?.valueUri,
        authorize = sec_ext.filter(
          (x: { url: string & Location }) => x.url === 'authorize',
        )?.[0]?.valueUri,
        introspect = sec_ext.filter(
          (x: { url: string & Location }) => x.url === 'introspect',
        )?.[0]?.valueUri,
        manage = sec_ext.filter(
          (x: { url: string & Location }) => x.url === 'manage',
        )?.[0]?.valueUrik;

      console.log('- ' + meta_url);
      return {
        url: item.url,
        id: item.id,
        name: item.name,
        token,
        authorize,
        introspect,
        manage,
        managingOrganization: item.managingOrganization,
      };
    };

    try {
      const batches = [];
      const batchSize = 10;
      for (let i = 0; i < urls.length; i += batchSize) {
        batches.push(urls.slice(i, i + batchSize));
      }

      const results = [];
      const errors = [];
      for (const [iter, batch] of batches.entries()) {
        const metaPromises = batch.map(fetchMeta);
        const res = await Promise.allSettled(metaPromises);

        const successRes = res
          .filter((i) => i.status === 'fulfilled')
          .map((i) => (i as PromiseFulfilledResult<any>).value);
        const errorsRes = res
          .filter((i) => i.status === 'rejected')
          .map((i) => (i as PromiseRejectedResult).reason);

        results.push(...successRes);
        console.log(
          `BATCH ${TerminalColor.bgBlue(`${iter}`)}: Processed ${
            successRes.length
          } of ${batch.length} in batch. ` +
            TerminalColor.red(`${errorsRes.length} error(s) when processing.`),
        );
        errors.push(...errorsRes);
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

      if (errors.length) {
        const errorLogPath =
          fhirVersion === 'R4'
            ? './errorlog-r4.json'
            : './errorlog-dstu2.json';
        console.log(
          TerminalColor.red(
            `${errors.length} error(s) when processing. Check the errorlog for more details`,
          ),
        );
        fs.writeFileSync(errorLogPath, JSON.stringify(errors, null, 2));
      }
    } catch (e) {
      console.error(e);
    }
    console.log(TerminalColor.green('Done'));
  } catch (e) {
    console.error(e);
  }
})().catch((e) => console.error(e));
