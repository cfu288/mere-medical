/**
 * Like Promise.all, but keep the sync job alive until every worker finishes.
 * A rejected attachment must not leave sibling writes running after export.
 */
export async function waitForAll<T>(jobs: Promise<T>[]): Promise<T[]> {
  const result = Promise.all(jobs);
  // Observe the aggregate rejection immediately while draining its siblings.
  await Promise.allSettled([result, ...jobs]);
  return result;
}
