import React from 'react';
import { ButtonLoadingSpinner } from '../components/connection/ButtonLoadingSpinner';
import { QueryStatus } from './TimelineTab';
import { useLocalConfig } from '../components/providers/LocalConfigProvider';

function generateRandomQuestion() {
  const questions = [
    'How are my liver enzymes?',
    'When was my last flu shot?',
    'What was my blood pressure last visit?',
    'How is my cholesterol?',
    'What are my allergies?',
    // Add more questions as needed
  ];
  const randomIndex = Math.floor(Math.random() * questions.length);
  return questions[randomIndex];
}

export function SearchBar({
  query,
  setQuery,
  status,
  enableAIQuestionAnswering,
  setEnableAIQuestionAnswering,
  askAI,
  aiResponse,
}: {
  query: string;
  setQuery: (s: string) => void;
  status: QueryStatus;
  enableAIQuestionAnswering?: boolean;
  setEnableAIQuestionAnswering?: (b: boolean) => void;
  askAI?: () => Promise<void>;
  aiResponse?: string;
}) {
  const { experimental__use_openai_rag } = useLocalConfig();
  const [loadingState, setLoadingState] = React.useState<
    'IDLE' | 'LOADING' | 'COMPLETE'
  >('IDLE');
  return (
    <>
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
          <input
            tabIndex={1}
            type="text"
            name="search"
            id="search"
            placeholder={
              enableAIQuestionAnswering
                ? 'Ask a question (e.g., ' + generateRandomQuestion() + ')'
                : 'Search your medical records'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${
              enableAIQuestionAnswering
                ? 'focus:border-indigo-500 focus:ring-indigo-500'
                : 'focus:border-primary-500 focus:ring-primary-500'
            } transition-colors block w-full rounded-md border-gray-300 pl-10 pr-12 shadow-sm sm:text-sm`}
          />
          <div className="absolute inset-y-0 right-0 flex py-1.5 pr-1.5">
            <div className="inline-flex items-center px-2 ">
              {status === QueryStatus.LOADING && <ButtonLoadingSpinner />}
            </div>
          </div>
        </div>

        {experimental__use_openai_rag && setEnableAIQuestionAnswering && (
          <button
            onClick={() =>
              setEnableAIQuestionAnswering(!enableAIQuestionAnswering)
            }
            className={`self-stretch text-xs ml-2 transition-all ${
              enableAIQuestionAnswering
                ? 'bg-indigo-700 text-indigo-50 hover:text-indigo-100 hover:bg-indigo-600'
                : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
            } rounded-md px-2 py-1`}
          >
            {enableAIQuestionAnswering ? '✨ AI On' : 'AI Off'}
          </button>
        )}
      </div>
      {enableAIQuestionAnswering && (
        <div className="w-full flex flex-col justify-center align-middle items-center">
          <button
            onClick={async () => {
              setLoadingState('LOADING');
              askAI && (await askAI());
              setLoadingState('COMPLETE');
            }}
            disabled={loadingState === 'LOADING'}
            className={`transition-all text-xs ml-2 hover:scale-105 active:scale-100 ${
              enableAIQuestionAnswering
                ? 'bg-indigo-700 text-indigo-50 hover:bg-indigo-600'
                : ''
            } rounded-md mt-2 disabled:opacity-50 disabled:cursor-not-allowed p-2 disabled:bg-gradient-to-br disabled:from-indigo-700 disabled:via-purple-700 disabled:to-primary-700 font-bold hover:bg-gradient-to-br hover:from-indigo-700 hover:via-purple-700 hover:to-primary-700 background-animate`}
          >
            {' '}
            {loadingState === 'LOADING' ? (
              <>The AI is thinking</>
            ) : (
              <>{`✨ Ask AI "${query}"`} </>
            )}
          </button>
          {aiResponse && (
            <div className="relative whitespace-pre-line w-full p-2 pb-4 my-2 border rounded-md overflow-y-auto text-xs sm:mx-auto max-w-lg bg-indigo-50 border-indigo-200">
              {/* add badge in top right corner that says experimental */}
              <div className="absolute bottom-0 right-0 bg-indigo-200 text-indigo-700 text-xs font-bold p-1 px-2 bg-opacity-40 rounded-br-md rounded-tl-md">
                Experimental
              </div>
              {aiResponse}
            </div>
          )}
        </div>
      )}
    </>
  );
}
