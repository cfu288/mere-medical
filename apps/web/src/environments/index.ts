import Configuration from './config.json';
import { z } from 'zod';

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
    z.undefined(),
  ]),
  PUBLIC_URL: z.union([z.string().url().nullish(), z.literal('')]),
  REDIRECT_URI: z.union([z.string().url().nullish(), z.literal('')]),
  SENTRY_WEB_DSN: z.union([z.string().url().nullish(), z.literal('')]),
});

type Config = z.infer<typeof Config>;

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

export const getOnPatientConfig = () => {
  return OnPatientConfig.parse(Configuration);
};

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
