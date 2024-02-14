import { useCallback, useEffect, useRef, useState } from 'react';

import { AppPage } from '../components/AppPage';
import { GenericBanner } from '../components/GenericBanner';
import { usePeriodAnimation } from '../components/hooks/usePeriodAnimation';
import { useLocalConfig } from '../components/providers/LocalConfigProvider';
import { useNotificationDispatch } from '../components/providers/NotificationProvider';
import { useRxDb } from '../components/providers/RxDbProvider';
import { useUser } from '../components/providers/UserProvider';
import { useVectors } from '../components/providers/vector-provider';
import { ChatInput } from '../features/mere-ai-chat/components/ChatInput';
import { MessageBubble } from '../features/mere-ai-chat/components/MessageBubble';
import { performRAGRequestwithOpenAI } from '../features/mere-ai-chat/open-ai/performRAGRequestwithOpenAI';
import { ChatMessage } from '../features/mere-ai-chat/types/ChatMessage';
import uuid4 from '../utils/UUIDUtils';
import { ExperimentalBanner } from '../features/mere-ai-chat/components/ExperimentalBanner';

function useScrollEffect(
  scrollRef: React.RefObject<HTMLDivElement>,
  isLoadingAiResponse: boolean,
) {
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isLoadingAiResponse && scrollRef.current) {
      intervalId = setInterval(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 1000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isLoadingAiResponse, scrollRef]);
}

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
        text: "Hi there! I'm the Mere Assistant. Ask me any question about your medical records.",
        timestamp: new Date(),
        id: uuid4(),
      },
    ]),
    isAiMessage = (message: ChatMessage) => message.user === 'AI',
    scrollRef = useRef<HTMLDivElement>(null);

  const callAskAI = useCallback(
    async (messageText: string) => {
      if (!isLoadingAiResponse && vectorStorage) {
        setIsLoadingAiResponse(true);
        try {
          const responseText = await performRAGRequestwithOpenAI({
            query: messageText,
            data: [],
            idsOfMostRelatedChunksFromSemanticSearch: [],
            streamingMessageCallback: (c: string) =>
              setAiLoadingText((p) => p + c),
            messages: messages,
            openAiKey: experimental__openai_api_key,
            db,
            user,
            vectorStorage,
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
        } catch (e) {
          notificationDispatch({
            message: e as unknown as string,
            variant: 'error',
            type: 'set_notification',
          });
        } finally {
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
        }
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

  useScrollEffect(scrollRef, isLoadingAiResponse);

  return (
    <AppPage banner={<GenericBanner text="Mere Assistant" />}>
      <div className="relative flex flex-col h-full overflow-hidden">
        <ExperimentalBanner />
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
