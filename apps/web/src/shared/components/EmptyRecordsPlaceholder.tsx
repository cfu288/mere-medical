import { PlusIcon } from '@heroicons/react/20/solid';
import { Link } from 'react-router-dom';
import { Routes } from '../../Routes';

export function EmptyRecordsPlaceholder() {
  return (
    <div className="relative flex h-full w-full flex-col justify-center bg-gray-100 p-10 align-middle">
      <div>
        <h1 className="text-primary-700 text-4xl font-bold">
          Link your medical records
        </h1>
        <p className="mt-2 max-w-96 text-xl text-gray-800">
          Get started by connecting to a patient portal
        </p>
        <div className="mt-8">
          <Link to={Routes.AddConnection}>
            <button
              type="button"
              className="bg-primary-800 hover:bg-primary-600 focus:ring-primary-600 inline-flex items-center rounded-md border border-transparent px-4 py-3 font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
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
