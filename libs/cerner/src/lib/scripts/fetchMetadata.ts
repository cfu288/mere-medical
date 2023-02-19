// deno run --allow-read --allow-write --allow-net fetchMetadata.ts

try {
  const data: string = await Deno.readTextFile('./DSTU2Endpoints.json');

  const content = JSON.parse(data);

  const metaPromises = content.map(async (item: { url: string }) => {
    const meta_url = `${item.url}metadata`;
    const res = await (
      await fetch(meta_url, {
        headers: {
          Accept: 'application/json+fhir',
        },
      })
    ).json();

    const sec_ext = res?.rest?.[0].security.extension?.[0].extension;
    const token = sec_ext.filter((x) => x.url === 'token')?.[0]?.valueUri;
    const authorize = sec_ext.filter((x) => x.url === 'authorize')?.[0]
      ?.valueUri;
    const introspect = sec_ext.filter((x) => x.url === 'introspect')?.[0]
      ?.valueUri;
    const manage = sec_ext.filter((x) => x.url === 'manage')?.[0]?.valueUri;

    item.token = token;
    item.authorize = authorize;
    item.introspect = introspect;
    item.manage = manage;

    console.log(meta_url);
    return item;
  });

  try {
    const res = await Promise.allSettled<{
      url: string;
      token: string;
      authorize: string;
      manage: string;
    }>(metaPromises);
    const successRes = res
      .filter((i) => i.status === 'fulfilled')
      .map((i) => i.value);

    const errors = res
      .filter((i) => i.status === 'rejected')
      .map((i) => i.value);

    console.log(`${errors.length} error(s) when processing`);

    await Deno.writeTextFile(
      './DSTU2Endpoints.json',
      JSON.stringify(successRes)
    );
  } catch (e) {
    console.error(e);
  }
  console.log('Done');
} catch (e) {
  console.error(e);
}
