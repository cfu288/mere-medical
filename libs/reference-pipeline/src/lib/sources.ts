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
    type: z.literal('html'),
    url: z.string().trim().url(),
  }),
  z.object({ ...common, type: z.literal('pdf'), url: z.string().trim().url() }),
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

export function parseSources(raw: unknown): Source[] {
  return sourcesSchema.parse(raw);
}
