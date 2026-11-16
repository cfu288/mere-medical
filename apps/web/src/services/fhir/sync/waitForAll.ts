/**
 * Waits for every job to finish, then throws if a job failed.
 *
 * Promise.all throws on the first failure while the other jobs still write
 * records. The encryption migration copies the database only after those
 * writes finish.
 *
 * @param jobs - the promises of one sync job that write records
 * @returns the value of each job, in the order of `jobs`
 * @throws the failure of a failed job in `jobs`
 * @example await waitForAll(attachments.map(saveAttachment));
 */
export async function waitForAll<T>(jobs: Promise<T>[]): Promise<T[]> {
  const outcomes = await Promise.allSettled(jobs);
  const values: T[] = [];
  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') throw outcome.reason;
    values.push(outcome.value);
  }
  return values;
}
