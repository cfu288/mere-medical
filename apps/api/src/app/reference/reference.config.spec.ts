import { parseReferenceLibraryConfig } from './reference.config';

describe('parseReferenceLibraryConfig', () => {
  it.each([
    ['unset', {}],
    ['blank', { REFERENCE_DB_PATH: '' }],
    ['only spaces', { REFERENCE_DB_PATH: '  ' }],
    ['an unfilled placeholder', { REFERENCE_DB_PATH: '$REFERENCE_DB_PATH' }],
  ])('is disabled when REFERENCE_DB_PATH is %s', (_, env) => {
    expect(parseReferenceLibraryConfig(env)).toEqual({ status: 'disabled' });
  });

  it('is enabled with the path REFERENCE_DB_PATH names, ignoring spaces around it', () => {
    expect(
      parseReferenceLibraryConfig({
        REFERENCE_DB_PATH: ' /data/references.db ',
      }),
    ).toEqual({ status: 'enabled', path: '/data/references.db' });
  });
});
