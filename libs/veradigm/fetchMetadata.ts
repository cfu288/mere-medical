import * as fs from 'fs';
import 'dotenv/config';
import chalk from 'chalk';

/**
 * This script is used to fetch the metadata for all of the DSTU2 endpoints listed by Epic.
 */
(async () => {
  try {
    const URL = process.env['DSTU2_ENDPOINTS_URL'];
    console.log('Starting DSTU2 Endpoint Metadata Fetcher for VERADIGM');
    console.log(`Using URL: ${URL}`);

    const data = await fetch(URL as string, {
      headers: {
        Accept: 'application/json+fhir',
      },
    }).then((res) => res.json());

    let urls: {
      id: string;
      name: string;
      url: string;
    }[] = data?.entry.map((i: any) => {
      return {
        id: i.resource.contained?.[0]?.id,
        name: i.resource.contained?.[0]?.name,
        url: i.resource?.address,
      };
    });

    // dedupe urls
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
            Accept: 'application/json+fhir',
          },
        })
      ).json();

      const sec_ext = res?.rest?.[0].security.extension?.[0].extension,
        token = sec_ext?.filter(
          (x: { url: string & Location }) => x.url === 'token'
        )?.[0]?.valueUri,
        authorize = sec_ext?.filter(
          (x: { url: string & Location }) => x.url === 'authorize'
        )?.[0]?.valueUri,
        introspect = sec_ext?.filter(
          (x: { url: string & Location }) => x.url === 'introspect'
        )?.[0]?.valueUri,
        manage = sec_ext?.filter(
          (x: { url: string & Location }) => x.url === 'manage'
        )?.[0]?.valueUri;

      if (!token && !authorize) {
        throw new Error(
          `No token and authorize endpoint found for ${meta_url}`
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
        // print errors
        errorsRes.forEach((e) => console.error(e));

        results.push(...successRes);
        console.log(
          `BATCH ${chalk.bgBlue(`${iter}`)}: Processed ${
            successRes.length
          } of ${batch.length} in batch. ` +
            chalk.red(`${errorsRes.length} error(s) when processing.`)
        );
        errors.push(...errorsRes);
      }

      // add sandbox
      results.push({
        id: 'sandbox_veradigm',
        name: 'Veradigm Sandbox',
        url: 'https://fhir.fhirpoint.open.allscripts.com/fhirroute/open/CustProProdSand201SMART/',
        token:
          'https://open.allscripts.com/fhirroute/fmhpatientauth/0cd760ae-6ec5-4137-bf26-4269636b94ef/connect/token/',
        authorize:
          'https://open.allscripts.com/fhirroute/fmhpatientauth/0cd760ae-6ec5-4137-bf26-4269636b94ef/connect/authorize/',
      });
      results.push({
        id: 'sandbox_touchworks',
        name: 'TouchWorks Sandbox',
        url: 'https://tw181unityfhir.open.allscripts.com/OPEN/',
        token:
          'https://open.allscripts.com/fhirroute/patientauth/e75746a4-7f05-4b95-9ff5-44082c988959/connect/token/',
        authorize:
          'https://open.allscripts.com/fhirroute/patientauth/e75746a4-7f05-4b95-9ff5-44082c988959/connect/authorize/',
      });

      fs.writeFileSync(
        './src/lib/data/DSTU2Endpoints.json',
        JSON.stringify(results, null, 2)
      );

      if (errors.length) {
        console.log(
          chalk.red(
            `${errors.length} error(s) when processing. Check the errorlog for more details`
          )
        );
        fs.writeFileSync('./errorlog.json', JSON.stringify(errors));
      }
    } catch (e) {
      console.error(e);
    }
    console.log(chalk.green('Done'));
  } catch (e) {
    console.error(e);
  }
})().catch((e) => console.error(e));
