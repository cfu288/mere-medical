import Configuration from './config.json';
import { z } from 'zod';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ZodError } from 'zod';

const Config = z.object({
  ONPATIENT_CLIENT_ID: z.string().optional(),
  EPIC_CLIENT_ID: z.string().optional(),
  EPIC_SANDBOX_CLIENT_ID: z.string().optional(),
  CERNER_CLIENT_ID: z.string().optional(),
  VERADIGM_CLIENT_ID: z.string().optional(),
  VA_CLIENT_ID: z.string().optional(),
  IS_DEMO: z.union([
    z.literal('enabled'),
    z.literal('disabled'),
    z.literal('$IS_DEMO'), // Can be set to this if value is not set as an environment variable
    z.undefined(),
  ]),
  PUBLIC_URL: z.union([z.string().url().nullish(), z.literal('')]),
  REDIRECT_URI: z.union([z.string().url().nullish(), z.literal('')]),
});

type Config = z.infer<typeof Config>;

/**
 * Get the configuration object
 * @returns Config object
 * @throws {ZodError} Error if the configuration is invalid
 */
export const getConfig = (): Config => {
  try {
    return Config.parse(Configuration);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.log(err.issues);
    }
    throw err;
  }
};

const OnPatientConfig = z.object({
  ONPATIENT_CLIENT_ID: z.string(),
});

/**
 * Get the OnPatient configuration object
 * @returns OnPatientConfig object
 * @throws {ZodError} Error if the configuration is invalid
 */
export const getOnPatientConfig = () => {
  return OnPatientConfig.parse(Configuration);
};

/**
 * Get the configured redirect URI
 * @returns The configured redirect URI
 * @throws {ZodError} Error if the configuration is invalid
 */
export const getRedirectUri = () => {
  try {
    const config = Config.parse(Configuration);
    return config.REDIRECT_URI || config.PUBLIC_URL;
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.log(err.issues);
    }
    throw err;
  }
};
