import * as fs from 'fs';
import 'dotenv/config';
import chalk from 'chalk';

/**
 * This script is used to fetch the metadata for all of the DSTU2 endpoints listed by Epic.
 */
(async () => {
  try {
    console.log('Starting DSTU2 Endpoint Metadata Fetcher for EPIC');
    console.log(`Using URL: ${process.env.DSTU2_ENDPOINTS_URL}`);

    const data = await fetch(process.env.DSTU2_ENDPOINTS_URL, {
      headers: {
        Accept: 'application/json+fhir',
      },
    }).then((res) => res.json());

    const urls: {
      id: string;
      name: string;
      url: string;
    }[] = data?.entry.map((i: any) => {
      console.log(i.resource?.address);
      return {
        id: i.resource?.id,
        name: i.resource?.name,
        url: i.resource?.address,
      };
    });

    if (!urls || !urls.length) {
      throw new Error('No content found');
    }

    const fetchMeta = async (item: {
      id: string;
      name: string;
      url: string;
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
        token = sec_ext.filter((x) => x.url === 'token')?.[0]?.valueUri,
        authorize = sec_ext.filter((x) => x.url === 'authorize')?.[0]?.valueUri,
        introspect = sec_ext.filter((x) => x.url === 'introspect')?.[0]
          ?.valueUri,
        manage = sec_ext.filter((x) => x.url === 'manage')?.[0]?.valueUri;

      console.log('- ' + meta_url);
      return {
        url: item.url,
        id: item.id,
        name: item.name,
        token,
        authorize,
        introspect,
        manage,
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
          `BATCH ${chalk.bgBlue(iter)}: Processed ${successRes.length} of ${
            batch.length
          } in batch. ` +
            chalk.red(`${errorsRes.length} error(s) when processing.`)
        );
        errors.push(...errorsRes);
      }

      // add sandbox
      results.push({
        id: 'sandbox',
        name: 'Sandbox',
        url: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/DSTU2/',
        token: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
        authorize:
          'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
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
        fs.writeFileSync('./errorlog.json', JSON.stringify(errors, null, 2));
      }
    } catch (e) {
      console.error(e);
    }
    console.log(chalk.green('Done'));
  } catch (e) {
    console.error(e);
  }
})().catch((e) => console.error(e));
