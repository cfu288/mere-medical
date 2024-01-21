import { GenericBanner } from '../components/GenericBanner';
import { AppPage } from '../components/AppPage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/outline';
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

type ChatMessage = {
  user: 'AI' | 'USER';
  text: string;
  timestamp?: Date;
};

function MereAITab() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      user: 'AI',
      text: "Hi there! I'm the Mere AI Assistant. Ask me any question about your medical records.",
      timestamp: new Date(),
    },
  ]);
  const user = useUser();
  const db = useRxDb();
  const vectorStorage = useVectorStorage();
  const { experimental__openai_api_key } = useLocalConfig();
  const [isLoadingAiResponse, setIsLoadingAiResponse] = useState(false);
  const notificationDispatch = useNotificationDispatch();
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

        return await fetch('https://api.openai.com/v1/chat/completions', {
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
          }),
        })
          .then((r) => r.json())
          .then((response) => {
            return response.choices[0].message.content;
          });
      }
    },
    [db, experimental__openai_api_key, user],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const periodText = usePeriodAnimation();

  useEffect(() => {
    if (messages.length !== 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.user === 'USER') {
        const messageText = lastMessage.text;
        if (vectorStorage) {
          setIsLoadingAiResponse(true);
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
          fetchRecordsWithVectorSearch(db, vectorStorage, messageText)
            .then((groupedRecords) => {
              askAI(messageText, groupedRecords).then((response) => {
                setMessages([
                  ...messages,
                  {
                    user: 'AI',
                    text: response,
                    timestamp: new Date(),
                  },
                ]);
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
            })
            .catch((e) => {
              notificationDispatch({
                message: e,
                variant: 'error',
                type: 'set_notification',
              });
              setIsLoadingAiResponse(false);
            });
        }
      }
    }
  }, [askAI, db, messages, notificationDispatch, vectorStorage]);

  const isAiMessage = (message: ChatMessage) => message.user === 'AI';

  return (
    <AppPage banner={<GenericBanner text="Mere AI Assistant" />}>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="grow overflow-y-auto p-4" ref={scrollRef}>
          {messages.map((message, i) => (
            <div
              className={`flex gap-2.5 mt-6 items-start  ${isAiMessage(message) ? 'justify-start' : 'flex-row-reverse'}`}
            >
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 via-purple-300 to-primary-600 background-animate"
                // alt="Mere AI Assistant"
              >
                <SparklesIcon className="w-8 h-8 p-2 text-white" />
              </div>
              <div
                dir={`${isAiMessage(message) ? 'ltr' : 'rtl'}`}
                className={`flex flex-col w-full max-w-[320px] leading-1.5 p-4 rounded-e-xl rounded-es-xl  ${isAiMessage(message) ? 'bg-indigo-100 border-indigo-200' : 'border-gray-200 bg-gray-100'}`}
              >
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <span
                    className={`text-sm font-semibold text-gray-900 ${isAiMessage(message) ? 'text-indigo-900' : 'text-gray-900'}`}
                  >
                    {isAiMessage(message)
                      ? 'Mere AI Assistant'
                      : `${user.first_name ? `${user.first_name} ${user.last_name}` : 'You'}`}
                  </span>
                  <span
                    dir="ltr"
                    className="text-sm font-normal text-gray-500 dark:text-gray-400"
                  >
                    {message.timestamp &&
                      formatTimestampText(message.timestamp?.toISOString())}
                  </span>
                </div>
                <p
                  dir="ltr"
                  className={`whitespace-pre-line text-sm font-normal pt-2.5 ${isAiMessage(message) ? 'text-indigo-900' : 'text-gray-900'}`}
                >
                  {message.text}
                </p>
              </div>
            </div>
          ))}
          {isLoadingAiResponse && (
            <div className="flex gap-2.5 mt-6 items-start justify-start">
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 via-purple-300 to-primary-600 background-animate"
                // alt="Mere AI Assistant"
              >
                <SparklesIcon className="w-8 h-8 p-2 text-white" />
              </div>
              <div
                dir="ltr"
                className={`flex flex-col w-full max-w-[320px] leading-1.5 p-4 rounded-e-xl rounded-es-xl  bg-indigo-100 border-indigo-200`}
              >
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <span className="text-sm font-semibold text-gray-900 ">
                    Mere AI Assistant
                  </span>
                  <span className="text-sm font-normal text-gray-500 ">
                    {formatTimestampText(new Date().toISOString())}
                  </span>
                </div>
                <p className="text-sm font-normal pt-2.5 text-gray-900 ">
                  The AI is thinking{periodText}
                </p>
              </div>
            </div>
          )}
        </div>
        <ChatInput
          onSubmit={(item) =>
            setMessages((e) => [
              ...e,
              {
                user: 'USER',
                text: item,
                timestamp: new Date(),
              },
            ])
          }
        />
      </div>
    </AppPage>
  );
}

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

function ChatInput({ onSubmit }: { onSubmit: (message: string) => void }) {
  const [message, setMessage] = useState('');
  return (
    <form
      className="flex-none pb-4 bg-gray-50 md:pb-0"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage('');
        onSubmit(message);
      }}
    >
      <div className="flex items-center px-3 py-2 rounded-lg bg-gray-50 ">
        <textarea
          id="chat"
          rows={1}
          value={message}
          className="block mx-4 p-2.5 w-full text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Ask a question"
          onChange={(e) => setMessage(e.target.value)}
        ></textarea>
        <button
          type="submit"
          className="inline-flex justify-center p-2 text-primary-600 rounded-full cursor-pointer hover:bg-primary-100 "
        >
          <PaperAirplaneIcon className="w-5 h-5" />
          <span className="sr-only">Send message</span>
        </button>
      </div>
    </form>
  );
}

export default MereAITab;
