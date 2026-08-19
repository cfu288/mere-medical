export type SyncTask = () => Promise<unknown>;

export async function runSync(
  tasks: Record<string, SyncTask>,
): Promise<PromiseSettledResult<unknown>[]> {
  return await Promise.allSettled(
    Object.values(tasks).map(async (task) => task()),
  );
}
