// deno run --allow-read --allow-write --allow-net fetchMetadata.ts
const jobSet: Set<string> = new Set();

let lastJobCount = -1;
let numberOfTimesWithNoProgress = 0;

const interval = setInterval(() => {
  console.log(`Jobs left: ${jobSet.size}`);
}, 10000);

try {
  const data: string = await Deno.readTextFile('./parsedDSTU2Endpoints.json');

  const content = JSON.parse(data);

  const metaPromises = content.map(
    async (item: {
      url: string;
      manage: string;
      token: string;
      authorize: string;
      introspect: string;
    }) => {
      const meta_url = `${item.url}/metadata`;
      jobSet.add(meta_url);

      // const controller = new AbortController();
      // setTimeout(() => controller.abort(), 3000);

      try {
        const res = await fetch(meta_url, {
          headers: {
            // signal: controller.signal,
            Accept: 'application/json+fhir',
          },
        });
        const data = await res.json();

        const sec_ext = data?.rest?.[0].security.extension?.[0].extension;
        let token = sec_ext?.filter(
          (x: { url: string }) => x.url === 'token'
        )?.[0]?.valueUri;
        let authorize = sec_ext?.filter(
          (x: { url: string }) => x.url === 'authorize'
        )?.[0]?.valueUri;
        let introspect = sec_ext?.filter(
          (x: { url: string }) => x.url === 'introspect'
        )?.[0]?.valueUri;
        let manage = sec_ext?.filter(
          (x: { url: string }) => x.url === 'manage'
        )?.[0]?.valueUri;

        item.url = item.url?.endsWith('/') ? item.url : item.url + '/';

        if (token) {
          item.token = token?.endsWith('/') ? token : token + '/';
        }
        if (authorize) {
          item.authorize = authorize?.endsWith('/')
            ? authorize
            : authorize + '/';
        }
        if (introspect) {
          item.introspect = introspect?.endsWith('/')
            ? introspect
            : introspect + '/';
        }
        if (manage) {
          item.manage = manage?.endsWith('/') ? manage : manage + '/';
        }

        // console.log(`✅ ${meta_url}`);
        jobSet.delete(meta_url);
        return item;
      } catch (e) {
        // console.error(`❌ ${meta_url}`);
        return undefined;
      }
    }
  );

  try {
    await Deno.remove('./DSTU2Endpoints.json');
    await Deno.writeTextFile('./DSTU2Endpoints.json', '[');
  } catch (e) {
    console.log('No previous file to delete, continuing...');
  }

  try {
    for (const item of metaPromises) {
      const res = await item;
      // console.log(JSON.stringify(res));
      res &&
        (await Deno.writeTextFile(
          './DSTU2Endpoints.json',
          `${JSON.stringify(res)},`,
          {
            append: true,
          }
        ));
    }
  } catch (e) {
    // console.log(e);
  } finally {
    await Deno.writeTextFile('./DSTU2Endpoints.json', ']', {
      append: true,
    });
    console.log('Done');
    clearInterval(interval);
  }
} catch (e) {
  // console.error(e);
}

// setInterval(() => {
//   console.log(`Jobs left: ${jobSet.size}`);

//   const incomplete = [...jobSet];
//   incomplete.length > 0 &&
//     Deno.writeTextFileSync(
//       './unfinishedjoblog.txt',
//       JSON.stringify(incomplete)
//     );

//   if (incomplete.length === lastJobCount) {
//     if (numberOfTimesWithNoProgress >= 6) {
//       console.error('No progress made, cancelling sync job');
//       Deno.exit(1);
//     } else {
//       numberOfTimesWithNoProgress += 1;
//     }
//   } else {
//     lastJobCount = incomplete.length;
//   }
// }, 10000);
