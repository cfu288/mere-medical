import { z } from 'zod';

/**
 * Every field is `.catch(undefined)` because one resource type's field collides with
 * another's. `Endpoint.address` is a url string while `Organization.address` is an
 * array of postal addresses, and both share a directory bundle. A strict type here
 * rejects the whole directory over a field the adapter was never going to read.
 */
const resourceSchema = z
  .object({
    resourceType: z.string().optional().catch(undefined),
    id: z.string().optional().catch(undefined),
    name: z.string().optional().catch(undefined),
    address: z.string().optional().catch(undefined),
    managingOrganization: z
      .object({
        display: z.string().optional().catch(undefined),
        reference: z.string().optional().catch(undefined),
      })
      .optional()
      .catch(undefined),
    contained: z
      .array(
        z
          .object({
            id: z.string().optional().catch(undefined),
            name: z.string().optional().catch(undefined),
          })
          .passthrough(),
      )
      .optional()
      .catch(undefined),
    endpoint: z
      .array(
        z
          .object({ reference: z.string().optional().catch(undefined) })
          .passthrough(),
      )
      .optional()
      .catch(undefined),
    extension: z
      .array(
        z
          .object({
            url: z.string().optional().catch(undefined),
            valueReference: z
              .object({ reference: z.string().optional().catch(undefined) })
              .optional()
              .catch(undefined),
          })
          .passthrough(),
      )
      .optional()
      .catch(undefined),
  })
  .passthrough();

export const fhirBundleSchema = z.object({
  resourceType: z.literal('Bundle'),
  total: z.number().optional(),
  entry: z.array(z.object({ resource: resourceSchema.optional() })).default([]),
});

export type FhirBundle = z.infer<typeof fhirBundleSchema>;

type BundleParse =
  | { ok: true; bundle: FhirBundle }
  | { ok: false; error: string };

/** Decodes a raw body into a FHIR bundle, or the reason it is not one. */
export function parseBundle(body: string): BundleParse {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (error) {
    return { ok: false, error: String(error) };
  }
  const parsed = fhirBundleSchema.safeParse(json);
  return parsed.success
    ? { ok: true, bundle: parsed.data }
    : { ok: false, error: `not a FHIR bundle: ${parsed.error.message}` };
}

const securityExtensionSchema = z.object({
  url: z.string(),
  valueUri: z.string().optional(),
});

/** Models only the security extensions carrying SMART urls, the one slice of a CapabilityStatement the pipeline reads. */
export const capabilityStatementSchema = z.object({
  resourceType: z.string().optional(),
  rest: z
    .array(
      z.object({
        security: z
          .object({
            extension: z
              .array(
                z.object({
                  url: z.string(),
                  extension: z.array(securityExtensionSchema).optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export type CapabilityStatement = z.infer<typeof capabilityStatementSchema>;

const SMART_OAUTH_EXTENSION_URL =
  'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris';

/**
 * The SMART OAuth URIs a CapabilityStatement declares, or null when it declares no
 * security block at all.
 *
 * Prefers the extension carrying the registered SMART url and falls back to the first
 * one present, because some servers omit the url on the wrapper.
 */
export function readSmartUris(
  statement: CapabilityStatement,
): Record<string, string> | null {
  for (const rest of statement.rest ?? []) {
    const wrappers = rest.security?.extension ?? [];
    const smart =
      wrappers.find((w) => w.url === SMART_OAUTH_EXTENSION_URL) ?? wrappers[0];
    const inner = smart?.extension;
    if (!inner) continue;
    const uris: Record<string, string> = {};
    for (const entry of inner) {
      if (entry.valueUri) uris[entry.url] = entry.valueUri;
    }
    return uris;
  }
  return null;
}
