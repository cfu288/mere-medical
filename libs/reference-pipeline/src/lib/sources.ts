import { z } from 'zod';

const nonEmptyText = z.string().trim().min(1);

const kebabCaseId = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const fieldsEverySourceHas = {
  id: kebabCaseId,
  title: nonEmptyText,
  edition: nonEmptyText,
  summary: nonEmptyText,
};

const sourceSchema = z.discriminatedUnion('type', [
  z.object({
    ...fieldsEverySourceHas,
    type: z.enum(['html', 'pdf']),
    url: z.string().trim().url(),
  }),
  z.object({
    ...fieldsEverySourceHas,
    type: z.literal('cdc-media'),
    mediaId: z.coerce.number().int().positive(),
  }),
]);

/**
 * A reference to fetch, as listed in sources.json.
 *
 * `edition` is the version or date the publisher gives. The chat agent chooses
 * a reference by its `title` and `summary`, and these must say what the
 * reference covers.
 *
 * An `html` or `pdf` source gives a `url`. A `cdc-media` source gives a CDC
 * Media Library id instead. `fetchCdcMediaPage` uses that id to fetch the page.
 * The id is in the page's address at https://tools.cdc.gov/medialibrary.
 */
export type Source = z.infer<typeof sourceSchema>;

const sourcesSchema = z
  .array(sourceSchema)
  .refine(
    (sources) => new Set(sources.map((s) => s.id)).size === sources.length,
    { message: 'source ids must be unique' },
  );

/**
 * Checks the contents of sources.json and returns the sources. The CLI calls it
 * with the parsed JSON and passes the result to `buildReferenceLibrary`.
 *
 * It trims text fields and accepts a `mediaId` written as a string.
 *
 * @param raw `unknown`. The parsed JSON.
 * @returns `Source[]`.
 * @throws `ZodError` when a source is malformed or two sources share an id.
 *
 * @example
 * parseSources([
 *   {
 *     id: 'measles-vaccine',
 *     type: 'cdc-media',
 *     mediaId: '13310',
 *     title: ' Measles Vaccine ',
 *     edition: 'Updated continuously',
 *     summary: 'Who needs the vaccine',
 *   },
 * ]);
 * // [
 * //   {
 * //     id: 'measles-vaccine',
 * //     type: 'cdc-media',
 * //     mediaId: 13310,
 * //     title: 'Measles Vaccine',
 * //     edition: 'Updated continuously',
 * //     summary: 'Who needs the vaccine',
 * //   },
 * // ]
 */
export function parseSources(raw: unknown): Source[] {
  return sourcesSchema.parse(raw);
}
