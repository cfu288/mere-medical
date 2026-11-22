export function LoadErrorPlaceholder({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex h-full w-full flex-col items-center justify-center p-10 text-center"
    >
      <p className="text-xl text-gray-800 dark:text-gray-200">
        Unable to load your records
      </p>
      <button
        type="button"
        className="bg-primary-800 hover:bg-primary-600 focus:ring-primary-600 mt-6 rounded-md px-4 py-3 font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}
