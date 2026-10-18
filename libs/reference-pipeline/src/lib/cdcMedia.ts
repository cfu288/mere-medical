import { z } from 'zod';

const CDC_MEDIA_API = 'https://tools.cdc.gov/api/v2/resources/media';

const cdcMediaSchema = z.object({
  results: z
    .tuple([z.object({ sourceUrl: z.string().url() })])
    .rest(z.unknown()),
});

/**
 * Fetches a CDC page through CDC's content API. `buildReferenceLibrary` uses it
 * for each `cdc-media` source.
 *
 * The API gives the page's text without the cdc.gov menus. It also gives the
 * page's cdc.gov address, which the library stores as the reference's url.
 *
 * @param mediaId `number`. The page's id in the CDC Media Library.
 * @param fetchBytes `(url: string) => Promise<Uint8Array>`. From
 * `createRateLimitedFetch`.
 * @returns `Promise<{ url: string; html: string }>`. The cdc.gov address, and
 * the page's html for `htmlToBlocks`.
 *
 * @example
 * await fetchCdcMediaPage(133745, createRateLimitedFetch());
 * // {
 * //   url: 'https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-age.html',
 * //   html: '...',
 * // }
 */
export async function fetchCdcMediaPage(
  mediaId: number,
  fetchBytes: (url: string) => Promise<Uint8Array>,
): Promise<{ url: string; html: string }> {
  const metadata = await fetchBytes(`${CDC_MEDIA_API}/${mediaId}.json`);
  const metadataJson = new TextDecoder().decode(metadata);
  const url = cdcMediaSchema.parse(JSON.parse(metadataJson)).results[0]
    .sourceUrl;
  const page = await fetchBytes(`${CDC_MEDIA_API}/${mediaId}/content.html`);
  return { url, html: new TextDecoder().decode(page) };
}
