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

/**
 * This script is used to fetch the metadata for all of the DSTU2 endpoints listed by Epic.
 */
(async () => {
  try {
    console.log('Starting R4 Endpoint Metadata Fetcher for HEALOW');
    console.log(`Using local file: ${process.env.R4_FILE_LOCATION}`);
    console.log(`Using name file: ${process.env.R4_NAME_FILE_LOCATION}`);

    if (!process.env.R4_FILE_LOCATION) {
      throw new Error('R4_FILE_LOCATION is not set');
    }

    if (!process.env.R4_NAME_FILE_LOCATION) {
      throw new Error('R4_NAME_FILE_LOCATION is not set');
    }

    const data = JSON.parse(
      fs.readFileSync(process.env.R4_FILE_LOCATION, 'utf8'),
    );

    const name_raw_data = JSON.parse(
      fs.readFileSync(process.env.R4_NAME_FILE_LOCATION, 'utf8'),
    );

    const name_data = name_raw_data.map((n: any) => {
      return [n.practice?.code, n.practice?.display_name];
    });

    const nameMap = new Map<string, string>(name_data);

    const urlsMap = new Map<
      string,
      {
        id: string;
        name: string;
        url: string;
        managingOrganization: string;
      }
    >();

    data?.entry.forEach((n: any) => {
      const nid = n.resource?.id;
      const existing = urlsMap.get(nid);

      if (existing) {
        //merge
        urlsMap.set(nid, {
          id: n.resource?.id,
          name: n.resource?.name || existing?.name,
          url:
            typeof n.resource?.address === 'string' ||
            n.resource?.address instanceof String
              ? n.resource?.address
              : existing.url,
          managingOrganization:
            n.resource?.managingOrganization?.reference ||
            existing.managingOrganization,
        });
      } else {
        urlsMap.set(nid, {
          id: n.resource?.id,
          name:
            typeof n.resource?.address === 'string' ||
            n.resource?.address instanceof String
              ? n.resource?.name
              : '',
          url: n.resource?.address,
          managingOrganization: n.resource?.managingOrganization?.reference,
        });
      }
    });

    const urls: {
      id: string;
      name: string;
      url: string;
      managingOrganization: string;
    }[] = Array.from(urlsMap.values()).map((n) => {
      if (!n.name) {
        n.name = nameMap.get(n.id) || '';
      }
      return n;
    });

    if (!urls || !urls.length) {
      throw new Error('No content found');
    }

    console.log(`Found ${urls.length} R4 endpoints`);

    const fetchMeta = async (item: {
      id: string;
      name: string;
      url: string;
      managingOrganization: string;
    }) => {
      const meta_url = `${item.url}/metadata`;
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
      const batches: any[] = [];
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
      //   // add sandbox
      //   results.push({
      //     id: 'sandbox_epic',
      //     name: 'Epic MyChart Sandbox',
      //     url: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/DSTU2/',
      //     token: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      //     authorize:
      //       'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
      //   });

      fs.writeFileSync(
        './src/lib/data/DSTU2Endpoints.json',
        JSON.stringify(results, null, 2),
      );

      if (errors.length) {
        console.log(
          TerminalColor.red(
            `${errors.length} error(s) when processing. Check the errorlog for more details`,
          ),
        );
        fs.writeFileSync('./errorlog.json', JSON.stringify(errors, null, 2));
      }
    } catch (e) {
      console.error(e);
    }
    console.log(TerminalColor.green('Done'));
  } catch (e) {
    console.error(e);
  }
})().catch((e) => console.error(e));
