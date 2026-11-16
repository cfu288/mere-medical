import {
  newSyncJobQueue,
  pauseJobs,
  resumeJobs,
  startJob,
} from './syncJobQueue';

/** A job that the test finishes by hand. */
function manualJob() {
  let finish!: () => void;
  const job = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return { job, finish };
}

/** Waits until every ready promise callback is complete. */
function afterPromiseCallbacks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('startJob', () => {
  it('starts the job and reports it', () => {
    const { job } = manualJob();
    const run = jest.fn().mockReturnValue(job);
    const onStart = jest.fn();

    startJob(newSyncJobQueue(), 'epic', 'request', run, onStart);

    expect(run).toHaveBeenCalledWith('request');
    expect(onStart).toHaveBeenCalledWith('epic', job);
  });

  it('does not start a second job for an id that is running', () => {
    const queue = newSyncJobQueue();
    const run = jest.fn().mockReturnValue(manualJob().job);

    startJob(queue, 'epic', 'first request', run, jest.fn());
    startJob(queue, 'epic', 'second request', run, jest.fn());

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('starts a job again after the first job for that id finishes', async () => {
    const queue = newSyncJobQueue();
    const run = jest.fn().mockResolvedValue(undefined);

    startJob(queue, 'epic', 'first request', run, jest.fn());
    await afterPromiseCallbacks();
    startJob(queue, 'epic', 'second request', run, jest.fn());

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('starts a job again after the first job for that id fails', async () => {
    const queue = newSyncJobQueue();
    const run = jest.fn().mockRejectedValue(new Error('failed job'));

    startJob(queue, 'epic', 'first request', run, jest.fn());
    await afterPromiseCallbacks();
    startJob(queue, 'epic', 'second request', run, jest.fn());

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not start a job while the queue is paused', async () => {
    const queue = newSyncJobQueue();
    const run = jest.fn();
    await pauseJobs(queue);

    startJob(queue, 'epic', 'request', run, jest.fn());

    expect(run).not.toHaveBeenCalled();
  });
});

describe('pauseJobs', () => {
  it('waits for a running job to finish', async () => {
    const queue = newSyncJobQueue();
    const { job, finish } = manualJob();
    const onPaused = jest.fn();
    startJob(queue, 'epic', 'request', () => job, jest.fn());

    void pauseJobs(queue).then(onPaused);
    await afterPromiseCallbacks();

    expect(onPaused).not.toHaveBeenCalled();
    finish();
    await afterPromiseCallbacks();
    expect(onPaused).toHaveBeenCalled();
  });

  it('resolves after a running job fails', async () => {
    const queue = newSyncJobQueue();
    const run = jest.fn().mockRejectedValue(new Error('failed job'));
    startJob(queue, 'epic', 'request', run, jest.fn());

    await expect(pauseJobs(queue)).resolves.toBeUndefined();
  });
});

describe('resumeJobs', () => {
  it('starts a request that the queue held', async () => {
    const queue = newSyncJobQueue();
    const { job } = manualJob();
    const run = jest.fn().mockReturnValue(job);
    const onStart = jest.fn();
    await pauseJobs(queue);
    startJob(queue, 'epic', 'request', run, jest.fn());

    resumeJobs(queue, run, onStart);

    expect(run).toHaveBeenCalledWith('request');
    expect(onStart).toHaveBeenCalledWith('epic', job);
  });

  it('starts only the last request that the queue held for an id', async () => {
    const queue = newSyncJobQueue();
    const run = jest.fn().mockResolvedValue(undefined);
    await pauseJobs(queue);
    startJob(queue, 'epic', 'first request', run, jest.fn());
    startJob(queue, 'epic', 'second request', run, jest.fn());

    resumeJobs(queue, run, jest.fn());

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('second request');
  });

  it('starts a held request only one time', async () => {
    const queue = newSyncJobQueue();
    const run = jest.fn().mockResolvedValue(undefined);
    await pauseJobs(queue);
    startJob(queue, 'epic', 'request', run, jest.fn());
    resumeJobs(queue, run, jest.fn());
    await pauseJobs(queue);

    resumeJobs(queue, run, jest.fn());

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('lets a new job start', async () => {
    const queue = newSyncJobQueue();
    const run = jest.fn().mockResolvedValue(undefined);
    await pauseJobs(queue);
    resumeJobs(queue, run, jest.fn());

    startJob(queue, 'epic', 'request', run, jest.fn());

    expect(run).toHaveBeenCalledWith('request');
  });
});
