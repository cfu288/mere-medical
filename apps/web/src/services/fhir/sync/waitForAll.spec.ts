import { waitForAll } from './waitForAll';

it('returns successful results in input order', async () => {
  await expect(
    waitForAll([Promise.resolve('first'), Promise.resolve('second')]),
  ).resolves.toEqual(['first', 'second']);
});

it('drains siblings and preserves the first observed rejection', async () => {
  let rejectLater!: (reason: Error) => void;
  const later = new Promise<never>((_, reject) => {
    rejectLater = reject;
  });
  const failure = new Error('first failure');
  let settled = false;
  const result = waitForAll([later, Promise.reject(failure)]);
  const observed = result.catch((error) => {
    settled = true;
    return error;
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(settled).toBe(false);
  rejectLater(new Error('later failure'));
  expect(await observed).toBe(failure);
});
