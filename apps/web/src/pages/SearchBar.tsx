import React, { useMemo } from 'react';
import { QueryStatus } from './TimelineTab';
import { useLocalConfig } from '../components/providers/LocalConfigProvider';

export function SearchBar({
  query,
  setQuery,
  status,
}: {
  query: string;
  setQuery: (s: string) => void;
  status: QueryStatus;
}) {
  const { experimental__use_openai_rag } = useLocalConfig();
  const placeholder = useMemo(
    () =>
      experimental__use_openai_rag
        ? '✨ Search you records with AI'
        : 'Search your medical records',
    [experimental__use_openai_rag],
  );
  return (
    <div className="mb-1 mt-4 w-full sm:mt-6 flex flex-row">
      <div className="relative flex items-center flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ">
          <svg
            aria-hidden="true"
            className="h-5 w-5 text-gray-800 dark:text-gray-700"
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
        {experimental__use_openai_rag ? (
          <div className="w-full bg-gradient-to-br from-indigo-400 via-purple-300 to-primary-600 p-[3px] background-animate rounded-md">
            <input
              tabIndex={1}
              type="text"
              name="search"
              id="search"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`border-transparent border-0 focus:border-transparent focus:ring-0 outline-none transition-colors block w-full rounded-md pl-10 ${status === QueryStatus.LOADING ? 'pr-12' : ''} shadow-sm sm:text-sm`}
            />
          </div>
        ) : (
          <input
            tabIndex={1}
            type="text"
            name="search"
            id="search"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${
              experimental__use_openai_rag
                ? 'focus:border-indigo-500 focus:ring-indigo-500'
                : 'focus:border-primary-500 focus:ring-primary-500'
            } transition-colors block w-full rounded-md border-gray-300 pl-10 ${status === QueryStatus.LOADING ? 'pr-12' : ''} shadow-sm sm:text-sm`}
          />
        )}
      </div>
    </div>
  );
}
