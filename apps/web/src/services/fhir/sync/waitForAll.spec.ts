import { waitForAll } from './waitForAll';

describe('waitForAll', () => {
  it('returns the values in the order of the jobs', async () => {
    const values = await waitForAll([
      Promise.resolve('first'),
      Promise.resolve('second'),
    ]);

    expect(values).toEqual(['first', 'second']);
  });

  it('waits for a running job after another job fails', async () => {
    let finishRunningJob!: () => void;
    const runningJob = new Promise<void>((resolve) => {
      finishRunningJob = resolve;
    });
    const failure = new Error('failed job');
    const onDone = jest.fn();

    const result = waitForAll([runningJob, Promise.reject(failure)]);
    result.catch(onDone);
    // A timer runs after every promise callback that is ready to run.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onDone).not.toHaveBeenCalled();
    finishRunningJob();
    await expect(result).rejects.toBe(failure);
  });
});
