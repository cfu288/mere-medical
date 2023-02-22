export const SyncWorker = new Worker(
  new URL('../workers/sync-worker.ts', import.meta.url)
);

export type SyncActions = 'sync';

export const syncWorkerDispatch = ({
  action,
  data,
}: {
  action: SyncActions;
  data: { baseUrl: string; connectionDocumentId: string };
}) => SyncWorker.postMessage({ action, data });

SyncWorker.onmessage = (event: MessageEvent<{ error: string }>) => {
  if (event.data.error) {
    console.error(event.data.error);
  }
};
