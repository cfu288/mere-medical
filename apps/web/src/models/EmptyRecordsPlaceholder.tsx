import { PlusIcon } from '@heroicons/react/20/solid';
import { Link } from 'react-router-dom';
import { Routes } from '../Routes';

export function EmptyRecordsPlaceholder() {
  return (
    <div className="relative mt-4 block w-full rounded-lg  p-12 text-center focus:outline-none">
      <div className="text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No medical records
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by connecting to a patient portal
        </p>
        <div className="mt-6">
          <Link to={Routes.AddConnection}>
            <button
              type="button"
              className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 inline-flex items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Add Patient Portal
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
