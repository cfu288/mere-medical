import { memo } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useUser } from '../../../components/providers/UserProvider';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import React from 'react';
import { ChatMessage } from '../types/ChatMessage';
import { formatTimestampText } from '../formatters/formatTimestampText';

export const MessageBubble = memo(function MessageBubble({
  message,
  isAiMessage,
}: {
  message: ChatMessage;
  isAiMessage: boolean;
}) {
  const user = useUser();
  return (
    <div
      dir={isAiMessage ? 'ltr' : 'rtl'}
      className={`flex gap-2.5 mt-6 items-start justify-start `}
    >
      {isAiMessage ? (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 via-purple-300 to-primary-600 background-animate">
          <SparklesIcon className="w-8 h-8 p-2 text-white" />
        </div>
      ) : (
        <>
          {user?.profile_picture?.data ? (
            <div className=" w-8 h-8 flex-shrink-0 rounded-full border border-indigo-700">
              <img
                className="h-full w-full rounded-full text-gray-300"
                src={user.profile_picture.data}
                alt="profile"
              ></img>
            </div>
          ) : (
            <div className=" w-8 h-8 flex-shrink-0 rounded-full border border-indigo-700">
              <svg
                className="h-full w-full rounded-full text-gray-300"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          )}
        </>
      )}
      <div
        dir="ltr"
        className={`flex flex-col w-full max-w-[320px] md:max-w-md lg:max-w-lg leading-1.5 p-4 rounded-e-xl rounded-es-xl gap-0 ${isAiMessage ? 'bg-indigo-100 border-indigo-200' : 'border-gray-200 bg-gray-100'}`}
      >
        <div className="flex items-center space-x-2 ">
          <span
            className={`text-sm font-semibold ${isAiMessage ? 'text-indigo-900' : 'text-gray-900'}`}
          >
            {isAiMessage
              ? 'Mere AI Assistant'
              : user && user.first_name
                ? `${user.first_name} ${user.last_name}`
                : 'You'}
          </span>
          <span className="text-sm font-normal text-gray-500">
            {message.timestamp
              ? formatTimestampText(message.timestamp.toISOString())
              : ''}
          </span>
        </div>
        <p
          className={`prose block whitespace-pre-line text-sm font-normal pt-2.5 ${isAiMessage ? 'text-indigo-900' : 'text-gray-900'}`}
        >
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ node, ...props }) => (
                <h1
                  {...props}
                  className={`-my-1 text-2xl font-semibold ${isAiMessage ? 'text-indigo-900' : 'text-gray-900'}`}
                />
              ),
              h2: ({ node, ...props }) => (
                <h2
                  {...props}
                  className={`-my-1 text-1xl font-semibold ${isAiMessage ? 'text-indigo-900' : 'text-gray-900'}`}
                />
              ),
              h3: ({ node, ...props }) => (
                <h3
                  {...props}
                  className={`-my-1 text-xl font-semibold ${isAiMessage ? 'text-indigo-900' : 'text-gray-900'}`}
                />
              ),
              h4: ({ node, ...props }) => (
                <h4
                  {...props}
                  className={`-my-1 text-lg font-semibold ${isAiMessage ? 'text-indigo-900' : 'text-gray-900'}`}
                />
              ),
              ol: ({ node, ...props }) => (
                <ol {...props} className={`-my-1 list-decimal list-inside`} />
              ),
              ul: ({ node, ...props }) => (
                <ul {...props} className={`-my-1 list-disc list-inside`} />
              ),
              // p: ({ node, ...props }) => <p {...props} className={``} />,
              li: ({ node, ...props }) => <li {...props} className={``} />,
              table: ({ node, ...props }) => (
                <div className="mx-auto border border-indigo-300 rounded-md overflow-x-auto overflow-y-hidden w-full max-w-[280px] md:max-w-[24rem]">
                  <table {...props} className={`-my-1 table-auto rounded-md`}>
                    {props.children || null}
                  </table>
                </div>
              ),
              pre: ({ node, ...props }) => (
                <pre {...props} className={`-my-1`} />
              ),
              p: ({ node, ...props }) => <p {...props} className={`-my-1`} />,
              thead: ({ node, ...props }) => (
                <thead
                  {...props}
                  className={`uppercase rounded-tr-md rounded-tl-md border-b border-indigo-300 ${isAiMessage ? 'text-indigo-900' : 'text-gray-900'}`}
                />
              ),
              tbody: ({ node, ...props }) => (
                <tbody {...props} className={`divide-y divide-indigo-200`} />
              ),
              tr: ({ node, ...props }) => (
                <tr {...props} className={`-my-1 `} />
              ),
              th: ({ node, ...props }) => (
                <th
                  {...props}
                  className={`-my-1 p-1 ${isAiMessage ? 'text-indigo-900' : 'text-gray-900'}`}
                />
              ),
              td: ({ node, ...props }) => (
                <td {...props} className={`-my-1 p-1`} />
              ),
            }}
          >
            {message.text}
          </Markdown>
        </p>
      </div>
    </div>
  );
});
