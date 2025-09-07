import Config from './config.json';
import ProdConfig from './config.prod.json';
import { getConfig, getOnPatientConfig, getRedirectUri } from './index';

describe('Development configuration', () => {
  it('IS_DEMO mode should be set to disabled', () => {
    expect(Config.IS_DEMO).toBe('disabled');
  });
});

describe('Production configuration', () => {
  it('should have the same number of parameters as development', () => {
    expect(Object.keys(Config).length).toBe(Object.keys(ProdConfig).length);
  });

  it('should have key:value pairs set to "KEY: $KEY"', () => {
    Object.entries(ProdConfig).forEach((pair) => {
      expect(`${pair[0]}`).toBe(`${pair[1]}`.slice(1));
    });
  });
});

describe('Configuration helpers', () => {
  it('getConfig() returns valid config', () => {
    expect(getConfig()).toEqual(Config);
  });

  it('getOnPatientConfig() returns valid config', () => {
    expect(getOnPatientConfig()).toEqual({
      ONPATIENT_CLIENT_ID: Config.ONPATIENT_CLIENT_ID,
    });
  });

  it('getRedirectUri() returns valid public URI if REDIRECT_URI is not set', () => {
    expect(getRedirectUri()).toBe(Config.PUBLIC_URL);
  });
});
