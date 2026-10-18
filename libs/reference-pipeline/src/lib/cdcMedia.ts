import { z } from 'zod';

// Serves a cdc.gov page's content without the site navigation.
const CDC_MEDIA_API = 'https://tools.cdc.gov/api/v2/resources/media';

const cdcMediaSchema = z.object({
  results: z
    .tuple([z.object({ sourceUrl: z.string().url() })])
    .rest(z.unknown()),
});

/**
 * Fetches a CDC page's content through CDC's content API.
 *
 * @param mediaId `number`. The page's id in the CDC Media Library.
 * @param fetchBytes `(url: string) => Promise<Uint8Array>`. Returns the body
 * at a url, and throws when it cannot.
 * @returns `Promise<{ url: string; html: string }>`. The cdc.gov address of the
 * page and its content as html.
 * @throws `ZodError` when the API's description of the page has no address.
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
