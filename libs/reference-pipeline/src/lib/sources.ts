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
 * One entry of sources.json, naming one reference to fetch.
 *
 * `title`, `edition` and `summary` describe the reference, and the library
 * stores them trimmed. The chat agent chooses a reference by its title and
 * summary. An `html` or `pdf` source gives a `url`. For a cdc.gov page, use
 * `cdc-media` with its `mediaId`. CDC's content API then gives the page's text
 * without the site menus.
 */
export type Source = z.infer<typeof sourceSchema>;

const sourcesSchema = z
  .array(sourceSchema)
  .refine(
    (sources) => new Set(sources.map((s) => s.id)).size === sources.length,
    { message: 'source ids must be unique' },
  );

/**
 * Parses sources.json into sources. The CLI calls it and passes the result to
 * `buildReferenceLibrary`.
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
