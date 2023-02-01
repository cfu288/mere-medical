import React from 'react';
import { ButtonLoadingSpinner } from '../components/connection/ButtonLoadingSpinner';
import { QueryStatus } from './TimelineTab';

export function SearchBar({
  query,
  setQuery,
  status,
}: {
  query: string;
  setQuery: (s: string) => void;
  status: QueryStatus;
}) {
  return (
    <div className="mt-6 mb-1 w-full">
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ">
          <svg
            aria-hidden="true"
            className="h-5 w-5 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
        </div>
        <input
          tabIndex={1}
          type="text"
          name="search"
          id="search"
          placeholder="Search your medical records"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="focus:border-primary-500 focus:ring-primary-500 block w-full rounded-md border-gray-300 pl-10 pr-12 shadow-sm sm:text-sm"
        />
        <div className="absolute inset-y-0 right-0 flex py-1.5 pr-1.5">
          <div className="inline-flex items-center px-2 ">
            {status === QueryStatus.LOADING && <ButtonLoadingSpinner />}
          </div>
        </div>
      </div>
    </div>
  );
}
