import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { main } from './cli';

describe('main', () => {
  it('exits nonzero when a vendor extract fails', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-'));
    process.env['EMR_WAREHOUSE_DB'] = path.join(dir, 'warehouse.db');
    process.env['EPIC_R4_ENDPOINTS_URL'] = 'https://directory.example.org/R4';
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('down', { status: 503 })) as typeof fetch;

    const code = await main(['extract']);

    globalThis.fetch = realFetch;
    delete process.env['EMR_WAREHOUSE_DB'];
    delete process.env['EPIC_R4_ENDPOINTS_URL'];
    fs.rmSync(dir, { recursive: true, force: true });
    expect(code).toBe(1);
  });
});
