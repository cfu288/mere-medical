import { runSync } from './runSync';

describe('runSync', () => {
  it('returns results in task order', async () => {
    await expect(
      runSync({
        Procedure: () => Promise.resolve('procedure'),
        Patient: () => Promise.resolve('patient'),
        Observation: () => Promise.resolve('observation'),
      }),
    ).resolves.toEqual([
      { status: 'fulfilled', value: 'procedure' },
      { status: 'fulfilled', value: 'patient' },
      { status: 'fulfilled', value: 'observation' },
    ]);
  });

  it('settles a synchronous throw as rejected', async () => {
    const reason = new Error('synchronous failure');

    await expect(
      runSync({
        Procedure: () => {
          throw reason;
        },
      }),
    ).resolves.toEqual([{ status: 'rejected', reason }]);
  });

  it('preserves the rejection reason by identity', async () => {
    const reason = { code: 'original-reason' };
    const results = await runSync({
      Procedure: () => Promise.reject(reason),
    });

    expect((results[0] as PromiseRejectedResult).reason).toBe(reason);
  });
});
