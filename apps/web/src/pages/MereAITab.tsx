import { GenericBanner } from '../components/GenericBanner';
import { AppPage } from '../components/AppPage';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useUser } from '../components/providers/UserProvider';
import { fetchRecordsWithVectorSearch } from './TimelineTab';
import { useRxDb } from '../components/providers/RxDbProvider';
import {
  prepareClinicalDocumentForVectorization,
  useVectorStorage,
} from '../components/providers/VectorStorageProvider';
import { BundleEntry, FhirResource } from 'fhir/r2';
import { getRelatedLoincLabs } from '../components/timeline/ObservationResultRow';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import { useLocalConfig } from '../components/providers/LocalConfigProvider';
import { useNotificationDispatch } from '../components/providers/NotificationProvider';
import { differenceInDays, format, parseISO } from 'date-fns';
import { usePeriodAnimation } from './usePeriodAnimation';
import uuid4 from '../utils/UUIDUtils';

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
    // Add more questions as needed
  ];
  const randomIndex = Math.floor(Math.random() * questions.length);
  return questions[randomIndex];
}

function MereAITab() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      user: 'AI',
      text: "Hi there! I'm the Mere AI Assistant. Ask me any question about your medical records.",
      timestamp: new Date(),
      id: uuid4(),
    },
  ]);
  const user = useUser();
  const db = useRxDb();
  const vectorStorage = useVectorStorage();
  const { experimental__openai_api_key } = useLocalConfig();
  const [isLoadingAiResponse, setIsLoadingAiResponse] = useState(false);
  const notificationDispatch = useNotificationDispatch();
  const [aiLoadingText, setAiLoadingText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAiMessage = (message: ChatMessage) => message.user === 'AI';

  const askAI = useCallback(
    async (
      query: string,
      data: Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>,
    ) => {
      if (data) {
        //prepare data as plattened list
        const dataAsList: Set<string> = new Set();

        for (const [_, itemList] of Object.entries(data)) {
          for (const item of itemList) {
            const minilist =
              prepareClinicalDocumentForVectorization(item).docList;
            const texts = [...minilist.map((i) => i.text)];
            for (const t of texts) {
              dataAsList.add(t);
            }
            // get related documents if item is a diagnostic report or observation
            if (
              item.data_record.raw.resource?.resourceType ===
                'DiagnosticReport' ||
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
              const relatedTexts = relatedList.map((i) => i.text);
              for (const rt of relatedTexts) {
                dataAsList.add(rt);
              }
            }
          }
          if (dataAsList.size > 100) {
            break;
          }
        }

        const response = await fetch(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${experimental__openai_api_key}`,
            },
            body: JSON.stringify({
              model: 'gpt-4-1106-preview',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a medical AI assistant. You will be given some data about a patient and a question. Please answer the question using the data provided and address the patient directly.',
                },
                {
                  role: 'system',
                  content: `Here is some information about your patient. Ignore any information that is not relevant to the question: 
Today's Date: ${new Date().toISOString()};
${user?.first_name && user?.last_name ? 'Name: ' + (user?.first_name + ' ' + user?.last_name) : ''}
${user?.birthday ? 'DOB: ' + user?.birthday : ''}
${user.gender ? 'Gender:' + user?.gender : ''}
Data: ${JSON.stringify([...dataAsList])}`,
                },
                {
                  role: 'user',
                  content: `The question is: ${query}`,
                },
              ],
              stream: true,
            }),
          },
        );
        const reader = response.body!.getReader();
        const decoder = new TextDecoder('utf-8');
        let responseText = '';

        // Read the response as a stream of data
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            const parsedLines = lines
              .map((line) => line.replace(/^data: /, '').trim()) // Remove the "data: " prefix
              .filter((line) => line !== '' && line !== '[DONE]') // Remove empty lines and "[DONE]"
              .map((line: string) => JSON.parse(line));
            for (const parsedLine of parsedLines) {
              const { choices } = parsedLine;
              const { delta } = choices[0];
              const { content } = delta;

              if (content) {
                setAiLoadingText((c) => c + content);
                responseText += content;
              }
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          reader.releaseLock();
        }
        return Promise.resolve(responseText);
      }
      return Promise.resolve();
    },
    [db, experimental__openai_api_key, user, setAiLoadingText],
  );

  const callAskAI = useCallback(
    (messageText: string) => {
      if (!isLoadingAiResponse && vectorStorage) {
        setIsLoadingAiResponse(true);
        fetchRecordsWithVectorSearch(db, vectorStorage, messageText)
          .then(
            async (
              groupedRecords: Record<
                string,
                ClinicalDocument<BundleEntry<FhirResource>>[]
              >,
            ) => {
              const responseText = await askAI(messageText, groupedRecords);
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
    [askAI, db, isLoadingAiResponse, notificationDispatch, vectorStorage],
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
                text: aiLoadingText,
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
      className={`flex gap-2.5 mt-6 items-start ${isAiMessage ? 'justify-start' : 'justify-end'}`}
    >
      {isAiMessage && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 via-purple-300 to-primary-600 background-animate">
          <SparklesIcon className="w-8 h-8 p-2 text-white" />
        </div>
      )}
      <div
        dir="ltr"
        className={`flex flex-col w-full max-w-[320px] leading-1.5 p-4 rounded-e-xl rounded-es-xl ${isAiMessage ? 'bg-indigo-100 border-indigo-200' : 'border-gray-200 bg-gray-100'}`}
      >
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
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

const ChatInput = memo(function ChatInput({
  onSubmit,
  isLoadingAiResponse,
}: {
  onSubmit: (message: string) => void;
  isLoadingAiResponse: boolean;
}) {
  const [message, setMessage] = useState('');
  const periodText = usePeriodAnimation();
  const placeholderText = useMemo(
    () => 'Search or ask a question (e.g., ' + generateRandomQuestion() + ')',
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
      <div className="flex flex-row items-center px-3 py-2 rounded-lg bg-gray-50 justify-center align-middle">
        <textarea
          id="chat"
          rows={1}
          value={message}
          className="block mx-4 p-2.5 w-full text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder={placeholderText}
          onChange={(e) => setMessage(e.target.value)}
        ></textarea>
        <button
          type="submit"
          disabled={isLoadingAiResponse}
          className={`min-w-18 whitespace-nowrap transition-all text-xs hover:scale-105 active:scale-100 shadow-indigo-500/50 hover:shadow-indigo-400/50 shadow-md hover:shadow-lg active:shadow-sm active:shadow-indigo-600/50 bg-indigo-700 text-indigo-50 hover:bg-indigo-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed p-2 py-3 disabled:bg-gradient-to-br disabled:scale-100 disabled:shadow-indigo-200/50 disabled:from-indigo-700 disabled:via-purple-700 disabled:to-indigo-700 font-bold hover:bg-gradient-to-br hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 background-animate`}
        >
          {' '}
          {isLoadingAiResponse ? <>{periodText}</> : <>{`✨ Ask AI`} </>}
          <span className="sr-only">Send message</span>
        </button>
      </div>
    </form>
  );
});

export default MereAITab;

// Streaming API, we want to use this instead of the promise based API
/**
 *     askAI = useCallback(async () => {
      setAiResponseText('');
      if (data) {
        //prepare data as plattened list
        const dataAsList: Set<string> = new Set();

        for (const [_, itemList] of Object.entries(data)) {
          for (const item of itemList) {
            const minilist =
              prepareClinicalDocumentForVectorization(item).docList;
            const texts = [...minilist.map((i) => i.text)];
            for (const t of texts) {
              dataAsList.add(t);
            }
            // get related documents if item is a diagnostic report or observation
            if (
              item.data_record.raw.resource?.resourceType ===
                'DiagnosticReport' ||
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
              const relatedTexts = relatedList.map((i) => i.text);
              for (const rt of relatedTexts) {
                dataAsList.add(rt);
              }
            }
          }
          if (dataAsList.size > 100) {
            break;
          }
        }

        const response = await fetch(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${experimental__openai_api_key}`,
            },
            body: JSON.stringify({
              model: 'gpt-4-1106-preview',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a medical AI assistant. You will be given some data about a patient and a question. Please answer the question using the data provided and address the patient directly.',
                },
                {
                  role: 'system',
                  content: `Here is some information about your patient. Ignore any information that is not relevant to the question: 
  Today's Date: ${new Date().toISOString()};
  ${user?.first_name && user?.last_name ? 'Name: ' + (user?.first_name + ' ' + user?.last_name) : ''}
  ${user?.birthday ? 'DOB: ' + user?.birthday : ''}
  ${user.gender ? 'Gender:' + user?.gender : ''}
  Data: ${JSON.stringify([...dataAsList])}`,
                },
                {
                  role: 'user',
                  content: `The question is: ${query}`,
                },
              ],
              stream: true,
            }),
          },
        );
        const reader = response.body!.getReader();
        const decoder = new TextDecoder('utf-8');

        // Read the response as a stream of data
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            const parsedLines = lines

              .map((line) => line.replace(/^data: /, '').trim()) // Remove the "data: " prefix
              .filter((line) => line !== '' && line !== '[DONE]') // Remove empty lines and "[DONE]"
              .map((line: string) => JSON.parse(line));
            for (const parsedLine of parsedLines) {
              const { choices } = parsedLine;
              const { delta } = choices[0];
              const { content } = delta;

              if (content) {
                setAiResponseText((c) => c + content);
              }
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          reader.releaseLock();
        }
      } else {
        console.error('Data is undefined');
        alert('Data is undefined');
      }
    }, [data, db, experimental__openai_api_key, query, user]);
 */
