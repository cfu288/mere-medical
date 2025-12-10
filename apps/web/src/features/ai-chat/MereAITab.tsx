import { useCallback, useEffect, useRef, useState } from 'react';
import { AppPage } from '../../shared/components/AppPage';
import { GenericBanner } from '../../shared/components/GenericBanner';
import { usePeriodAnimation } from '../../shared/hooks/usePeriodAnimation';
import { useLocalConfig } from '../../app/providers/LocalConfigProvider';
import { useNotificationDispatch } from '../../app/providers/NotificationProvider';
import { useRxDb } from '../../app/providers/RxDbProvider';
import { useUser } from '../../app/providers/UserProvider';
import { useVectors } from '../vectors';
import { useVectorSyncStatus } from '../vectors/providers/VectorGeneratorSyncInitializer';
import { ChatInput } from './components/ChatInput';
import { MessageBubble } from './components/MessageBubble';
import { performRAGRequest } from './performRAGRequest';
import { ChatMessage, AIMessage, UserMessage } from './types';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { BundleEntry, FhirResource } from 'fhir/r2';
import uuid4 from '../../shared/utils/UUIDUtils';
import { ExperimentalBanner } from './components/ExperimentalBanner';
import { UI_CONFIG } from './constants/config';

type UIAIMessage = AIMessage & {
  metadata?: {
    sourceDocs?: ClinicalDocument<BundleEntry<FhirResource>>[];
  };
};

type UIChatMessage = UserMessage | UIAIMessage;

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
      }, UI_CONFIG.SCROLL_INTERVAL_MS);
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
    vectorSyncStatus = useVectorSyncStatus(),
    {
      experimental__openai_api_key,
      experimental__ai_provider,
      experimental__ollama_endpoint,
      experimental__ollama_model,
      experimental__ollama_rerank_model,
    } = useLocalConfig(),
    notificationDispatch = useNotificationDispatch(),
    periodText = usePeriodAnimation();

  const [isLoadingAiResponse, setIsLoadingAiResponse] = useState(false),
    [aiLoadingText, setAiLoadingText] = useState(''),
    [statusMessage, setStatusMessage] = useState(''),
    [messages, setMessages] = useState<UIChatMessage[]>([
      {
        type: 'ai',
        text: "Hi there! I'm the Mere Assistant. Ask me any question about your medical records.",
        timestamp: new Date(),
        id: uuid4(),
        model: experimental__ai_provider || 'ollama',
        sourceDocIds: [],
        confidence: 1.0,
      } as UIAIMessage,
    ]),
    isAiMessage = (message: UIChatMessage) => message.type === 'ai',
    scrollRef = useRef<HTMLDivElement>(null);

  const callAskAI = useCallback(
    async (messageText: string) => {
      if (!isLoadingAiResponse && vectorStorage) {
        setIsLoadingAiResponse(true);
        setStatusMessage('');
        setAiLoadingText('');

        try {
          const result = await performRAGRequest({
            query: messageText,
            streamingMessageCallback: (c: string) =>
              setAiLoadingText((p) => p + c),
            messages: messages as ChatMessage[],
            aiProvider: experimental__ai_provider || 'ollama',
            openAiKey: experimental__openai_api_key,
            ollamaEndpoint: experimental__ollama_endpoint,
            ollamaModel: experimental__ollama_model,
            ollamaRerankModel: experimental__ollama_rerank_model,
            db,
            user,
            vectorStorage,
            onStatusUpdate: (status: string) => {
              setStatusMessage(status);
            },
          });
          if (result.responseText) {
            console.log(`[UI] Received RAG result:`, {
              responseLength: result.responseText.length,
              sourceDocsReceived: result.sourceDocs.length,
              sourceDocIds: result.sourceDocs.map((doc) => doc.id).slice(0, 5),
              sourceDocTypes: result.sourceDocs
                .map((doc) => doc.data_record?.raw?.resource?.resourceType)
                .slice(0, 5),
            });

            const newMessage: UIAIMessage = {
              type: 'ai',
              text: result.responseText,
              timestamp: new Date(),
              id: uuid4(),
              model: experimental__ai_provider || 'ollama',
              sourceDocIds: result.sourceDocs.map((doc) => doc.id),
              confidence: 0.8,
              metadata: {
                sourceDocs: result.sourceDocs,
              },
            };

            console.log(`[UI] Created UI message with:`, {
              sourceDocIdsCount: newMessage.sourceDocIds.length,
              metadataSourceDocsCount: newMessage.metadata?.sourceDocs?.length,
              messageId: newMessage.id,
            });

            setMessages((e) => [...e, newMessage]);
          }
          setAiLoadingText('');
        } catch (e) {
          const errorMessage =
            e instanceof Error ? e.message : 'An error occurred';
          notificationDispatch({
            message: errorMessage,
            variant: 'error',
            type: 'set_notification',
          });
          setAiLoadingText('');
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
            }, UI_CONFIG.SCROLL_DELAY_MS);
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
      experimental__ai_provider,
      experimental__ollama_endpoint,
      experimental__ollama_model,
      user,
      notificationDispatch,
    ],
  );

  useScrollEffect(scrollRef, isLoadingAiResponse);

  return (
    <AppPage banner={<GenericBanner text="Mere Assistant" />}>
      <div className="relative flex flex-col h-full overflow-hidden">
        <ExperimentalBanner />
        {vectorSyncStatus === 'IN_PROGRESS' ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Preparing Your Medical Records
              </h2>
              <p className="text-gray-600">
                We're processing your documents to enable intelligent search.
                <br />
                This may take a few minutes on first use.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grow overflow-y-auto p-4" ref={scrollRef}>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isAiMessage={isAiMessage(message)}
                />
              ))}
              {isLoadingAiResponse && (
                <MessageBubble
                  key="loading"
                  message={
                    {
                      type: 'ai',
                      id: 'loading',
                      text:
                        aiLoadingText ||
                        `${statusMessage || 'Mere Assistant is thinking'}${periodText}`,
                      timestamp: new Date(),
                      model: experimental__ai_provider || 'ollama',
                      sourceDocIds: [],
                      confidence: 0,
                    } as UIAIMessage
                  }
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
                    type: 'user',
                    text: item,
                    timestamp: new Date(),
                    id: uuid4(),
                  } as UserMessage,
                ]);
                callAskAI(item);
              }}
            />
          </>
        )}
      </div>
    </AppPage>
  );
}

export default MereAITab;
