/**
 * The state of the sync jobs. It has the jobs that run now and the requests
 * that wait.
 *
 * `running` has one job for each connection id. `held` has the last request
 * for each connection id that arrived while `paused` was true.
 */
export type SyncJobQueue<Request, Result> = {
  paused: boolean;
  running: Map<string, Promise<Result>>;
  held: Map<string, Request>;
};

/**
 * Makes a queue with no jobs.
 *
 * @returns a queue that is not paused
 * @example const queue = newSyncJobQueue<SyncContext, JobResults>();
 */
export function newSyncJobQueue<Request, Result>(): SyncJobQueue<
  Request,
  Result
> {
  return { paused: false, running: new Map(), held: new Map() };
}

/**
 * Starts the job for a request. A paused queue holds the request for
 * `resumeJobs`. The queue ignores the request while a job with the same id runs.
 *
 * @param queue - the queue that records the job
 * @param id - the id of the connection to sync
 * @param request - the input of the job
 * @param run - starts the job for one request
 * @param onStart - called with the id and the job when the job starts
 * @returns nothing. The queue records the job or holds the request.
 * @example startJob(queue, connection.id, syncContext, fetchMedicalRecords, showJob);
 */
export function startJob<Request, Result>(
  queue: SyncJobQueue<Request, Result>,
  id: string,
  request: Request,
  run: (request: Request) => Promise<Result>,
  onStart: (id: string, job: Promise<Result>) => void,
): void {
  if (queue.paused) {
    queue.held.set(id, request);
    return;
  }
  if (queue.running.has(id)) return;
  const job = run(request);
  queue.running.set(id, job);
  const finished = () => {
    queue.running.delete(id);
  };
  void job.then(finished, finished);
  onStart(id, job);
}

/**
 * Pauses the queue, then waits for every running job to finish.
 * The encryption migration calls this before it copies the database.
 *
 * @param queue - the queue to pause
 * @returns a promise that resolves when no job runs
 * @example await pauseJobs(queue);
 */
export async function pauseJobs<Request, Result>(
  queue: SyncJobQueue<Request, Result>,
): Promise<void> {
  // Pause first. No job can start after this function reads the running jobs.
  queue.paused = true;
  await Promise.allSettled(queue.running.values());
}

/**
 * Resumes a paused queue and starts each request that the queue held.
 *
 * @param queue - the queue to resume
 * @param run - starts the job for one request
 * @param onStart - called with the id and the job when each job starts
 * @returns nothing. The queue is not paused after the call.
 * @example resumeJobs(queue, fetchMedicalRecords, showJob);
 */
export function resumeJobs<Request, Result>(
  queue: SyncJobQueue<Request, Result>,
  run: (request: Request) => Promise<Result>,
  onStart: (id: string, job: Promise<Result>) => void,
): void {
  queue.paused = false;
  const requests = [...queue.held];
  queue.held.clear();
  requests.forEach(([id, request]) =>
    startJob(queue, id, request, run, onStart),
  );
}
