import { useEffect, useMemo, useRef, useState } from 'react';

import { AppPage } from '../../shared/components/AppPage';
import { GenericBanner } from '../../shared/components/GenericBanner';
import { useLocalConfig } from '../../app/providers/LocalConfigProvider';
import { useRxDb } from '../../app/providers/RxDbProvider';
import { useUser } from '../../app/providers/UserProvider';
import uuid4 from '../../shared/utils/UUIDUtils';
import {
  projectVisibleLog,
  summarizeRun,
} from '../patient-context/harness/describe';
import { useHarnessLog } from '../patient-context/harness/log';
import { project } from '../patient-context/harness/reducer';
import { AgentActivity } from './components/AgentActivity';
import { ChatInput } from './components/ChatInput';
import { ExperimentalBanner } from './components/ExperimentalBanner';
import { MessageBubble } from './components/MessageBubble';
import { resolveModelServer } from './constants/defaults';
import { ChatMessage } from './domain/chat-types';
import { ContextBudget } from '../patient-context/agent/contextWindow';
import {
  conversationFits,
  performAgentRequest,
  HistoryMessage,
} from './performAgentRequest';

const SCROLL_INTERVAL_MS = 1000;

const GREETING: ChatMessage = {
  type: 'ai',
  id: 'greeting',
  text: "Hi there! I'm the Mere Assistant. Ask me any question about your medical records.",
  timestamp: new Date(),
};

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
      }, SCROLL_INTERVAL_MS);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isLoadingAiResponse, scrollRef]);
}

function toHistory(messages: ChatMessage[]): HistoryMessage[] {
  return messages
    .filter((m) => m.type !== 'ai' || !m.isError)
    .map((m) => ({
      role: m.type === 'ai' ? 'assistant' : 'user',
      content: m.text,
    }));
}

function MereAITab() {
  const user = useUser();
  return <MereChat key={user.id} />;
}

function MereChat() {
  const user = useUser();
  const db = useRxDb();
  const localConfig = useLocalConfig();
  const { log, makeHarness } = useHarnessLog();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [context, setContext] = useState<ContextBudget | null>(null);
  const abortRef = useRef<AbortController>();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const liveState = useMemo(() => project(log), [log]);
  const running = liveState.kind === 'running';
  const historyFull = !conversationFits(context, toHistory(messages), '');
  useScrollEffect(scrollRef, running);
  const liveLines = useMemo(
    () =>
      liveState.kind === 'running'
        ? projectVisibleLog(
            log.filter((event) => event.runId === liveState.runId),
          )
        : [],
    [log, liveState],
  );

  const ask = async (question: string) => {
    if (running) {
      return;
    }
    if (!conversationFits(context, toHistory(messages), question)) {
      setMessages((e) => [
        ...e,
        { type: 'user', id: uuid4(), text: question, timestamp: new Date() },
        {
          type: 'ai',
          id: uuid4(),
          text: 'That message is too long for this conversation. Ask something shorter or start a new chat.',
          timestamp: new Date(),
          isError: true,
        },
      ]);
      return;
    }
    const abort = new AbortController();
    abortRef.current = abort;
    const history = toHistory(messages);
    setMessages((e) => [
      ...e,
      { type: 'user', id: uuid4(), text: question, timestamp: new Date() },
    ]);
    try {
      const { harness, events } = makeHarness();
      const result = await performAgentRequest({
        question,
        history,
        db,
        userId: user.id,
        ...resolveModelServer(localConfig),
        harness,
        signal: abort.signal,
      });
      const activity = {
        lines: projectVisibleLog(events),
        ...summarizeRun(events),
      };
      if (result.kind === 'answered') {
        setContext(result.context);
        setMessages((e) => [
          ...e,
          {
            type: 'ai',
            id: uuid4(),
            text: result.answer,
            timestamp: new Date(),
            activity,
          },
        ]);
      } else if (result.kind === 'failed') {
        setMessages((e) => [
          ...e,
          {
            type: 'ai',
            id: uuid4(),
            text: `Something went wrong: ${result.message}`,
            timestamp: new Date(),
            activity,
            isError: true,
          },
        ]);
      }
    } finally {
      abortRef.current = undefined;
    }
  };

  const copyDebugLog = () => {
    const dump = {
      exportedAt: new Date().toISOString(),
      events: log,
      messages,
    };
    navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
  };

  return (
    <AppPage banner={<GenericBanner text="Mere Assistant" />}>
      <div className="relative flex flex-col h-full overflow-hidden">
        <ExperimentalBanner />
        <div className="absolute right-2 top-1 z-10">
          <button
            className="rounded border border-indigo-300 bg-white/80 px-2 py-0.5 text-xs text-indigo-700 hover:bg-white disabled:opacity-40"
            disabled={log.length === 0}
            onClick={copyDebugLog}
          >
            Copy debug log (contains PHI)
          </button>
        </div>
        <div className="grow overflow-y-auto p-4" ref={scrollRef}>
          {messages.map((message) =>
            message.type === 'ai' && message.activity ? (
              <div key={message.id}>
                <AgentActivity phase="settled" activity={message.activity} />
                <MessageBubble message={message} />
              </div>
            ) : (
              <MessageBubble key={message.id} message={message} />
            ),
          )}
          {liveState.kind === 'running' && (
            <AgentActivity
              phase="live"
              current={liveState.activity}
              lines={liveLines}
            />
          )}
        </div>
        {historyFull && !running ? (
          <div className="flex-none bg-gray-50 p-3 text-center text-sm text-gray-600">
            This conversation is too long to continue.{' '}
            <button
              className="font-semibold text-indigo-700 underline"
              onClick={() => setMessages([GREETING])}
            >
              Start a new chat
            </button>
          </div>
        ) : (
          <ChatInput
            isLoadingAiResponse={running}
            onSubmit={ask}
            onStop={() => abortRef.current?.abort()}
          />
        )}
      </div>
    </AppPage>
  );
}

export default MereAITab;
