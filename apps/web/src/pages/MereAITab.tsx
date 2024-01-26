import { differenceInDays, format, parseISO } from 'date-fns';
import { BundleEntry, FhirResource } from 'fhir/r2';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RxDatabase } from 'rxdb';

import { SparklesIcon } from '@heroicons/react/24/outline';
import { IVSChunkMeta } from '@mere/vector-storage';

import { AppPage } from '../components/AppPage';
/* eslint-disable react/jsx-no-useless-fragment */
import { GenericBanner } from '../components/GenericBanner';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import { useLocalConfig } from '../components/providers/LocalConfigProvider';
import { useNotificationDispatch } from '../components/providers/NotificationProvider';
import { useRxDb } from '../components/providers/RxDbProvider';
import { useUser } from '../components/providers/UserProvider';
import { useVectors } from '../components/providers/vector-provider';
import { prepareClinicalDocumentForVectorization } from '../components/providers/vector-provider/helpers/prepareClinicalDocumentForVectorization';
import { getRelatedLoincLabs } from '../components/timeline/ObservationResultRow';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import { UserDocument } from '../models/user-document/UserDocument.type';
import uuid4 from '../utils/UUIDUtils';
import { fetchRecordsWithVectorSearch } from './TimelineTab';
import { usePeriodAnimation } from './usePeriodAnimation';

function MereAITab() {
  const user = useUser(),
    db = useRxDb(),
    vectorStorage = useVectors(),
    { experimental__openai_api_key } = useLocalConfig(),
    notificationDispatch = useNotificationDispatch(),
    periodText = usePeriodAnimation();

  const [isLoadingAiResponse, setIsLoadingAiResponse] = useState(false),
    [aiLoadingText, setAiLoadingText] = useState(''),
    [messages, setMessages] = useState<ChatMessage[]>([
      {
        user: 'AI',
        text: "Hi there! I'm the Mere AI Assistant. Ask me any question about your medical records.",
        timestamp: new Date(),
        id: uuid4(),
      },
    ]),
    scrollRef = useRef<HTMLDivElement>(null);

  const isAiMessage = (message: ChatMessage) => message.user === 'AI';

  const callAskAI = useCallback(
    (messageText: string) => {
      if (!isLoadingAiResponse && vectorStorage) {
        setIsLoadingAiResponse(true);
        fetchRecordsWithVectorSearch({
          db,
          vectorStorage,
          query: messageText,
          numResults: 8,
          enableSearchAttachments: true,
        })
          .then(
            async ({ records, idsOfMostRelatedChunksFromSemanticSearch }) => {
              const responseText = await performRAGwithOpenAI({
                query: messageText,
                data: records,
                idsOfMostRelatedChunksFromSemanticSearch,
                streamingCallback: (c: string) =>
                  setAiLoadingText((p) => p + c),
                messages: messages,
                openAiKey: experimental__openai_api_key,
                db,
                user,
              });
              if (responseText) {
                setMessages((e) => [
                  ...e,
                  {
                    user: 'AI',
                    text: responseText,
                    timestamp: new Date(),
                    id: uuid4(),
                  },
                ]);
              }
              setAiLoadingText('');
            },
          )
          .catch((e) => {
            notificationDispatch({
              message: e,
              variant: 'error',
              type: 'set_notification',
            });
          })
          .finally(() => {
            setIsLoadingAiResponse(false);
            if (scrollRef.current) {
              setTimeout(() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: 'smooth',
                  });
                }
              }, 100);
            }
          });
      }
    },
    [
      isLoadingAiResponse,
      vectorStorage,
      db,
      messages,
      experimental__openai_api_key,
      user,
      notificationDispatch,
    ],
  );

  useEffect(() => {
    if (messages.length !== 0) {
      if (scrollRef.current) {
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: 'smooth',
            });
          }
        }, 100);
      }
    }
  }, [isLoadingAiResponse, messages.length]);

  return (
    <AppPage banner={<GenericBanner text="Mere AI Assistant" />}>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="w-full bg-indigo-200 text-indigo-700 text-xs font-bold p-1 px-2 bg-opacity-40 text-center">
          Experimental
        </div>
        <div className="grow overflow-y-auto p-4" ref={scrollRef}>
          {messages.map((message, i) => (
            <MessageBubble
              key={message.id}
              message={message}
              isAiMessage={isAiMessage(message)}
            />
          ))}
          {isLoadingAiResponse && (
            <MessageBubble
              key="loading"
              message={{
                id: 'loading',
                user: 'AI',
                text:
                  aiLoadingText || 'Mere Assistant is thinking' + periodText,
                timestamp: new Date(),
              }}
              isAiMessage={true}
            />
          )}
        </div>
        <ChatInput
          isLoadingAiResponse={isLoadingAiResponse}
          onSubmit={async (item) => {
            setMessages((e) => [
              ...e,
              {
                user: 'USER',
                text: item,
                timestamp: new Date(),
                id: uuid4(),
              },
            ]);
            callAskAI(item);
          }}
        />
      </div>
    </AppPage>
  );
}

const MessageBubble = memo(function MessageBubble({
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
        className={`flex flex-col w-full max-w-[320px] md:max-w-md lg:max-w-lg leading-1.5 p-4 rounded-e-xl rounded-es-xl ${isAiMessage ? 'bg-indigo-100 border-indigo-200' : 'border-gray-200 bg-gray-100'}`}
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
          className={`whitespace-pre-line text-sm font-normal pt-2.5 ${isAiMessage ? 'text-indigo-900' : 'text-gray-900'}`}
        >
          {message.text}
        </p>
      </div>
    </div>
  );
});

const ChatInput = memo(function ChatInput({
  onSubmit,
  isLoadingAiResponse,
}: {
  onSubmit: (message: string) => void;
  isLoadingAiResponse: boolean;
}) {
  const [message, setMessage] = useState(''),
    periodText = usePeriodAnimation(),
    placeholderText = useMemo(
      () => 'Ask a question (e.g., ' + generateRandomQuestion() + ')',
      [],
    );

  return (
    <form
      className="flex-none pb-4 bg-gray-50 md:pb-0"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage('');
        onSubmit(message);
      }}
    >
      <div className="flex flex-row items-center p-2 rounded-lg bg-gray-50 justify-center align-middle">
        <input
          id="chat"
          // rows={1}
          value={message}
          className="block mr-2 h-full p-2.5 w-full text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder={placeholderText}
          onChange={(e) => setMessage(e.target.value)}
        ></input>
        <button
          type="submit"
          disabled={isLoadingAiResponse}
          className={`min-w-18 h-full whitespace-nowrap transition-all text-xs hover:scale-[102%] active:scale-100 shadow-indigo-500/50 hover:shadow-indigo-400/50 shadow-md hover:shadow-lg active:shadow-sm active:shadow-indigo-600/50 bg-indigo-700 text-indigo-50 hover:bg-indigo-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed p-2 py-3 disabled:bg-gradient-to-br disabled:scale-100 disabled:shadow-indigo-200/50 disabled:from-indigo-700 disabled:via-purple-700 disabled:to-indigo-700 font-bold hover:bg-gradient-to-br hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 background-animate`}
        >
          {isLoadingAiResponse ? <>{periodText}</> : <>{`✨ Ask AI`} </>}
          <span className="sr-only">Send message</span>
        </button>
      </div>
    </form>
  );
});

export default MereAITab;

function formatTimestampText(isoDate: string) {
  return Math.abs(differenceInDays(parseISO(isoDate), new Date())) >= 1
    ? `${formatTimestampToDay(isoDate)}`
    : `${formatTimestampToTime(isoDate)}`;
}

function formatTimestampToDay(isoDate: string) {
  return format(parseISO(isoDate), 'MMM dd');
}

function formatTimestampToTime(isoDate: string) {
  return format(parseISO(isoDate), 'p');
}

type ChatMessage = {
  user: 'AI' | 'USER';
  text: string;
  timestamp?: Date;
  id: string;
};

function generateRandomQuestion() {
  const questions = [
    'How are my liver enzymes?',
    'When was my last flu shot?',
    'What was my blood pressure last visit?',
    'How is my cholesterol?',
    'What are my allergies?',
    'What are my medications?',
  ];
  const randomIndex = Math.floor(Math.random() * questions.length);
  return questions[randomIndex];
}

const prepareDataForOpenAI = async ({
  data,
  db,
  user,
  idsOfMostRelatedChunksFromSemanticSearch,
}: {
  data: Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
  idsOfMostRelatedChunksFromSemanticSearch: string[];
}) => {
  const dataAsList: Set<string> = new Set();

  for (const itemList of Object.values(data)) {
    for (const item of itemList) {
      const chunkedClinicalDocsList =
        prepareClinicalDocumentForVectorization(item).docList;

      const chunkedCliicalDocsContainsAtLeastOneChunk =
        chunkedClinicalDocsList.some((i) => i.chunk);

      if (!chunkedCliicalDocsContainsAtLeastOneChunk) {
        const texts = chunkedClinicalDocsList.map((i) => i.text);
        texts.forEach((t) => dataAsList.add(t));
      } else {
        // chunkedClinicalDocsList contains many chunks, but we only want to pull the ones that are relevant
        // The relevant ones are the ones that have an id inside chunkMetadata
        const relevantChunks = chunkedClinicalDocsList.filter(
          (clinicalDocsChunk) => {
            const chunkWithSameId =
              idsOfMostRelatedChunksFromSemanticSearch.find(
                (metaChunkId) => metaChunkId === clinicalDocsChunk.id,
              );
            return chunkWithSameId !== undefined;
          },
        );
        const texts = relevantChunks.map((i) => i.text);
        texts.forEach((t) => dataAsList.add(t));
      }

      if (
        item.data_record.raw.resource?.resourceType === 'DiagnosticReport' ||
        item.data_record.raw.resource?.resourceType === 'Observation'
      ) {
        const loinc = item.metadata?.loinc_coding || [];
        const relatedDocs = await getRelatedLoincLabs({
          loinc,
          db,
          user,
          limit: 5,
        });
        const relatedList = relatedDocs.flatMap(
          (i) => prepareClinicalDocumentForVectorization(i).docList,
        );
        relatedList.forEach((i) => dataAsList.add(i.text));
      }
    }
    if (dataAsList.size > 100) {
      break;
    }
  }

  return [...dataAsList];
};

const callOpenAI = async ({
  query,
  messages,
  openAiKey,
  preparedData,
  streamingCallback,
  user,
}: {
  query: string;
  messages: ChatMessage[];
  openAiKey?: string;
  preparedData: string[];
  streamingCallback?: (message: string) => void;
  user: UserDocument;
}) => {
  const promptMessages = [
    {
      role: 'system',
      content:
        'You are a medical AI assistant. A patient is asking you a question. Please address the patient directly and explain your answer step by step. Show your work if possible.',
    },
    {
      role: 'system',
      content: `Here is some demographic information about the patient.
Today's Date: ${new Date().toISOString()};
${user?.first_name && user?.last_name ? 'Name: ' + (user?.first_name + ' ' + user?.last_name) : ''}
${user?.birthday ? 'DOB: ' + user?.birthday : ''}
${user?.birthday ? 'Age: ' + (differenceInDays(new Date(), parseISO(user?.birthday)) / 365)?.toFixed(1) : ''}
${user.gender ? 'Gender:' + user?.gender : ''}`,
    },
    ...messages.slice(-5).map((m) => ({
      role: m.user === 'AI' ? 'assistant' : 'user',
      content: m.text,
    })),
    {
      role: 'user',
      content: query,
    },
    {
      role: 'system',
      content: `Here are some medical records that may be relevant. Ignore and leave out any records not relevant to the question in your response.
Data: ${JSON.stringify(preparedData)}`,
    },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      // model: 'gpt-3.5-turbo-16k',
      messages: promptMessages,
      stream: true,
    }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let responseText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      const parsedLines = lines
        .map((line) => line.replace(/^data: /, '').trim())
        .filter((line) => line !== '' && line !== '[DONE]')
        .map((line) => JSON.parse(line));
      for (const parsedLine of parsedLines) {
        const { choices } = parsedLine;
        const { delta } = choices[0];
        const { content } = delta;

        if (content) {
          if (streamingCallback) {
            streamingCallback(content);
          }
          responseText += content;
        }
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    reader.releaseLock();
  }

  return responseText;
};

const performRAGwithOpenAI = async ({
  query,
  data,
  idsOfMostRelatedChunksFromSemanticSearch,
  streamingCallback,
  messages = [],
  openAiKey,
  db,
  user,
}: {
  query: string;
  data: Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>;
  idsOfMostRelatedChunksFromSemanticSearch: string[];
  streamingCallback?: (message: string) => void;
  messages: ChatMessage[];
  openAiKey?: string;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
}) => {
  try {
    if (data) {
      const preparedData = await prepareDataForOpenAI({
        data,
        db,
        user,
        idsOfMostRelatedChunksFromSemanticSearch,
      });
      const responseText = await callOpenAI({
        query,
        messages,
        openAiKey,
        preparedData,
        streamingCallback,
        user,
      });
      return Promise.resolve(responseText);
    }
    return Promise.resolve();
  } catch (e) {
    console.error(e);
    return Promise.reject(e);
  }
};
