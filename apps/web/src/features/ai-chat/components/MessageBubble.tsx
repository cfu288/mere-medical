import { memo, useState, useMemo } from 'react';
import {
  SparklesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useUser } from '../../../app/providers/UserProvider';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatTimestampText } from '../utils/date-formatters';
import { SourceDocumentsDisplay } from './SourceDocumentsDisplay';
import { parseThinkingTags } from '../utils/message-parser';
import { countRenderableDocuments } from '../utils/document-utils';

export const MessageBubble = memo(function MessageBubble({
  message,
  isAiMessage,
}: {
  message: any;
  isAiMessage: boolean;
}) {
  const user = useUser();
  const [showThinking, setShowThinking] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const { displayText, thinkingContent } = useMemo(
    () => parseThinkingTags(message.text, isAiMessage),
    [message.text, isAiMessage],
  );

  const textColorClass = isAiMessage ? 'text-indigo-900' : 'text-gray-900';
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
        className={`flex flex-col w-full max-w-[320px] md:max-w-md lg:max-w-lg leading-1.5 p-4 gap-0 ${isAiMessage ? 'bg-indigo-100 border-indigo-200 rounded-tr-xl rounded-br-xl rounded-bl-xl' : 'border-gray-200 bg-gray-100 rounded-tl-xl rounded-bl-xl rounded-br-xl'}`}
      >
        <div className="flex items-center space-x-2 ">
          <span
            className={`text-sm font-semibold ${isAiMessage ? 'text-indigo-900' : 'text-gray-900'}`}
          >
            {isAiMessage
              ? 'Mere Assistant'
              : user && user.first_name
                ? `${user.first_name} ${user.last_name}`
                : 'You'}
          </span>
          <span className="text-sm font-normal text-gray-500">
            {message.timestamp && message.timestamp instanceof Date
              ? formatTimestampText(message.timestamp.toISOString())
              : ''}
          </span>
        </div>
        <p
          className={`inline pt-2.5 ${isAiMessage ? 'text-indigo-900' : 'text-gray-900'}`}
        >
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ ...props }) => (
                <h1 {...props} className={textColorClass} />
              ),
              h2: ({ ...props }) => (
                <h2 {...props} className={textColorClass} />
              ),
              h3: ({ ...props }) => (
                <h3 {...props} className={textColorClass} />
              ),
              h4: ({ ...props }) => (
                <h4 {...props} className={textColorClass} />
              ),
              ol: ({ ...props }) => (
                <ol
                  {...props}
                  className={`marker:text-indigo-900 list-decimal list-outside ml-5 ${textColorClass}`}
                />
              ),
              li: ({ ...props }) => (
                <li {...props} className={textColorClass} />
              ),
              ul: ({ ...props }) => (
                <ul
                  {...props}
                  className={`marker:text-indigo-900 list-disc list-outside ml-5 ${textColorClass}`}
                />
              ),
              p: ({ ...props }) => <p {...props} className={textColorClass} />,
              table: ({ ...props }) => (
                <div className="mx-auto border border-indigo-300 rounded-md overflow-x-auto overflow-y-hidden w-full max-w-[280px] md:max-w-[24rem]">
                  <table {...props} className="table-auto rounded-md w-full">
                    {props.children || null}
                  </table>
                </div>
              ),
              pre: ({ ...props }) => <pre {...props} />,
              thead: ({ ...props }) => (
                <thead
                  {...props}
                  className={`uppercase rounded-tr-md rounded-tl-md border-b border-indigo-300 ${textColorClass}`}
                />
              ),
              tbody: ({ ...props }) => (
                <tbody {...props} className="divide-y divide-indigo-200" />
              ),
              tr: ({ ...props }) => <tr {...props} />,
              th: ({ ...props }) => (
                <th {...props} className={`p-1 ${textColorClass}`} />
              ),
              td: ({ ...props }) => <td {...props} className="p-1" />,
              strong: ({ ...props }) => (
                <strong
                  {...props}
                  className={`font-semibold ${textColorClass}`}
                />
              ),
            }}
          >
            {displayText}
          </Markdown>
        </p>

        {thinkingContent && (
          <div className="mt-3 border-t border-indigo-200 pt-3">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              {showThinking ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
              <span>Model Reasoning</span>
            </button>

            {showThinking && (
              <div className="mt-2 p-3 bg-indigo-50 rounded-md">
                <div className="text-xs font-semibold text-indigo-700 mb-1">
                  Internal Reasoning Process:
                </div>
                <div className=" text-indigo-800">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ ...props }) => (
                        <p
                          {...props}
                          className="text-indigo-800 text-xs leading-relaxed"
                        />
                      ),
                      strong: ({ ...props }) => (
                        <strong
                          {...props}
                          className="font-semibold text-indigo-900"
                        />
                      ),
                      ul: ({ ...props }) => (
                        <ul
                          {...props}
                          className="text-xs list-disc list-outside ml-5 text-indigo-800"
                        />
                      ),
                      ol: ({ ...props }) => (
                        <ol
                          {...props}
                          className="text-xs list-decimal list-outside ml-5 text-indigo-800"
                        />
                      ),
                      li: ({ ...props }) => (
                        <li {...props} className="text-indigo-800" />
                      ),
                    }}
                  >
                    {thinkingContent}
                  </Markdown>
                </div>
              </div>
            )}
          </div>
        )}

        {isAiMessage &&
          message.metadata?.sourceDocs &&
          countRenderableDocuments(message.metadata.sourceDocs) > 0 && (
            <div className="mt-3 border-t border-indigo-200 pt-3">
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {showSources ? (
                  <ChevronDownIcon className="w-4 h-4" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4" />
                )}
                <DocumentTextIcon className="w-4 h-4" />
                <span>
                  View{' '}
                  {countRenderableDocuments(message.metadata?.sourceDocs || [])}{' '}
                  source records
                </span>
              </button>

              {showSources && (
                <div className="mt-2">
                  <SourceDocumentsDisplay
                    sourceDocs={message.metadata?.sourceDocs || []}
                    isCollapsed={false}
                  />
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
});
