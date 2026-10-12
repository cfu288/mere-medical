import { z } from 'zod';

const text = z.string().trim().min(1);

const id = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const common = {
  id,
  title: text,
  edition: text,
  summary: text,
};

const sourceSchema = z.discriminatedUnion('type', [
  z.object({
    ...common,
    type: z.enum(['html', 'pdf']),
    url: z.string().trim().url(),
  }),
  z.object({
    ...common,
    type: z.literal('cdc-media'),
    mediaId: z.coerce.number().int().positive(),
  }),
]);

export type Source = z.infer<typeof sourceSchema>;

const sourcesSchema = z
  .array(sourceSchema)
  .refine(
    (sources) => new Set(sources.map((s) => s.id)).size === sources.length,
    { message: 'source ids must be unique' },
  );

/**
 * Parses the source configuration, such as the contents of sources.json.
 *
 * It trims text fields and turns a string `mediaId` into a number. Ids are
 * lowercase words joined by hyphens and must be unique.
 *
 * @param raw `unknown`. The parsed JSON.
 * @returns `Source[]`. Each source is `html` or `pdf` with a `url`, or
 * `cdc-media` with a `mediaId`.
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
