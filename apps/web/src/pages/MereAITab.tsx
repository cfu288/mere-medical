import { BundleEntry, FhirResource } from 'fhir/r2';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AppPage } from '../components/AppPage';
/* eslint-disable react/jsx-no-useless-fragment */
import { GenericBanner } from '../components/GenericBanner';
import { useLocalConfig } from '../components/providers/LocalConfigProvider';
import { useNotificationDispatch } from '../components/providers/NotificationProvider';
import { useRxDb } from '../components/providers/RxDbProvider';
import { useUser } from '../components/providers/UserProvider';
import { useVectors } from '../components/providers/vector-provider';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import uuid4 from '../utils/UUIDUtils';
import { fetchRecordsWithVectorSearch } from './TimelineTab';
import { usePeriodAnimation } from '../components/hooks/usePeriodAnimation';
import grainImage from '../img/grain.svg';
import React from 'react';
import { MessageBubble } from '../features/mere-ai/components/MessageBubble';
import { ChatInput } from '../features/mere-ai/components/ChatInput';
import { ChatMessage } from '../features/mere-ai/types/ChatMessage';
import { performRAGwithOpenAI } from '../features/mere-ai/open-ai/performRAGwithOpenAI';

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
          numResults: 10,
          enableSearchAttachments: true,
          groupByDate: false,
        })
          .then(async (result) => {
            const records: ClinicalDocument<BundleEntry<FhirResource>>[] = [
              ...Object.values(result.records).flat(),
            ];
            const idsOfMostRelatedChunksFromSemanticSearch = [
              ...result.idsOfMostRelatedChunksFromSemanticSearch,
            ];
            const responseText = await performRAGwithOpenAI({
              query: messageText,
              data: records,
              idsOfMostRelatedChunksFromSemanticSearch,
              streamingCallback: (c: string) => setAiLoadingText((p) => p + c),
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
          })
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
      <div className="relative flex flex-col h-full overflow-hidden">
        <div
          style={{
            background: 'rgb(199 210 254 / 0.4)',
            // @ts-ignore
            '--image-url': `url(${grainImage})`,
            // @ts-ignore
            '-webkit-backdrop-filter': 'blur(10px)',
            backdropFilter: 'blur(10px)',
          }}
          className={`absolute top-0 left-0 bg-[backdrop-filter:var(--tw-backdrop-blur)] w-full text-indigo-700 text-xs sm:text-sm font-bold p-1 px-2 bg-opacity-40 text-center`}
        >
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

export default MereAITab;
