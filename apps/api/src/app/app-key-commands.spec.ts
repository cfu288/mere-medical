import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { parseAppKey } from '@mere/shared';

const BIN = path.resolve(__dirname, '../../../../bin');

function run(command: string, env: Record<string, string>) {
  const result = spawnSync(process.execPath, [path.join(BIN, command)], {
    env: env as NodeJS.ProcessEnv,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe('generate-app-key', () => {
  it('prints an .env line with a key the server accepts', () => {
    const { status, stdout } = run('generate-app-key', {});

    expect(status).toBe(0);
    expect(stdout).toMatch(/^APP_KEY=[A-Za-z0-9_-]{32}\n$/);
    expect(parseAppKey(stdout.slice('APP_KEY='.length)).status).toBe('ok');
  });
});

describe('generate-invite-link', () => {
  it('prints an invite link with the token the server accepts, not the key', () => {
    expect(
      run('generate-invite-link', {
        PUBLIC_URL: 'https://mere.example.com/',
        APP_KEY: ' valid-app-key-for-the-test-suite ',
      }),
    ).toEqual({
      status: 0,
      stdout:
        'Invite link: https://mere.example.com/#registration-token=3ebnq9Avix4S-QZ4rLC47V-crei4F3IT7PqAOFSlCeA\n',
      stderr: '',
    });
  });

  it.each([
    [
      'no key',
      { PUBLIC_URL: 'https://mere.example.com' },
      'APP_KEY is not set. Generate one with generate-app-key, add it to .env, and recreate the container.\n',
    ],
    [
      'no public URL',
      { APP_KEY: 'valid-app-key-for-the-test-suite' },
      'PUBLIC_URL must be the full address of this instance, such as https://mere.example.com.\n',
    ],
    [
      'a public URL without a scheme',
      {
        PUBLIC_URL: 'mere.example.com',
        APP_KEY: 'valid-app-key-for-the-test-suite',
      },
      'PUBLIC_URL must be the full address of this instance, such as https://mere.example.com.\n',
    ],
  ])('refuses with %s', (_name, env, stderr) => {
    expect(run('generate-invite-link', env)).toEqual({
      status: 1,
      stdout: '',
      stderr,
    });
  });
});
