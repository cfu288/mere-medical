import { isAbortError } from './abort';
import { MAX_COMPLETION_TOKENS, OLLAMA_REQUEST_TIMEOUT_MS } from '../constants';

export type OllamaToolDef = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolCall = {
  id?: string;
  name: string;
  args: Record<string, unknown>;
};

export type WireMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: unknown[] }
  | { role: 'tool'; tool_call_id?: string; content: string };

export type AssistantTurn = {
  content: string;
  toolCalls: ToolCall[];
  truncated: boolean;
  promptTokens: number | null;
  rawMessage: WireMessage;
};

const CONTEXT_OVERFLOW =
  /maximum context length|max_model_len|context window|context length/i;

type RawToolCall = {
  id?: string;
  function?: { name?: string; arguments?: unknown };
};

export function isOpenAiEndpoint(endpoint: string): boolean {
  return /\/v1\/?$/.test(endpoint);
}

export async function testOllamaConnection(
  endpoint: string,
  apiKey?: string,
): Promise<boolean> {
  const url = isOpenAiEndpoint(endpoint)
    ? `${endpoint.replace(/\/$/, '')}/models`
    : `${endpoint}/api/tags`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function chat({
  endpoint,
  model,
  messages,
  tools,
  apiKey,
  signal,
}: {
  endpoint: string;
  model: string;
  messages: WireMessage[];
  tools?: OllamaToolDef[];
  apiKey?: string;
  signal?: AbortSignal;
}): Promise<AssistantTurn> {
  const openAi = isOpenAiEndpoint(endpoint);
  const url = openAi
    ? `${endpoint.replace(/\/$/, '')}/chat/completions`
    : `${endpoint}/api/chat`;
  const body = JSON.stringify(
    openAi
      ? {
          model,
          messages,
          tools,
          stream: false,
          max_tokens: MAX_COMPLETION_TOKENS,
        }
      : {
          model,
          messages,
          tools,
          stream: false,
          options: { num_predict: MAX_COMPLETION_TOKENS },
        },
  );
  const timeout = AbortSignal.timeout(OLLAMA_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body,
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new Error(
        `Model request timed out after ${Math.round(OLLAMA_REQUEST_TIMEOUT_MS / 1000)}s (${endpoint})`,
      );
    }
    if (isAbortError(e)) {
      throw e;
    }
    throw new Error(
      `Could not reach the model server at ${endpoint}: ${String(e)}`,
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      response.status === 400 && CONTEXT_OVERFLOW.test(body)
        ? "This conversation is too long for the model's context window. Start a new chat."
        : `Model server at ${endpoint} returned ${response.status}: ${body}`,
    );
  }
  const data = await response.json();
  const message = openAi
    ? data?.choices?.[0]?.message ?? {}
    : data?.message ?? {};
  const truncated = openAi
    ? data?.choices?.[0]?.finish_reason === 'length'
    : data?.done_reason === 'length';
  const rawToolCalls: RawToolCall[] = Array.isArray(message.tool_calls)
    ? message.tool_calls
    : [];
  const content = stripThinking(String(message.content ?? ''));
  const promptTokens = openAi
    ? data?.usage?.prompt_tokens
    : data?.prompt_eval_count;
  return {
    content,
    truncated,
    promptTokens:
      typeof promptTokens === 'number' && promptTokens > 0
        ? promptTokens
        : null,
    toolCalls: rawToolCalls
      .filter((call) => call.function?.name)
      .map((call) => ({
        id: call.id,
        name: String(call.function?.name),
        args: asArgs(call.function?.arguments),
      })),
    rawMessage: {
      role: 'assistant',
      content,
      ...(rawToolCalls.length > 0 ? { tool_calls: message.tool_calls } : {}),
    },
  };
}

function stripThinking(content: string): string {
  const stripped = content.replace(/<think>[\s\S]*?<\/think>/g, '');
  const lastClose = stripped.lastIndexOf('</think>');
  const tail =
    lastClose === -1 ? stripped : stripped.slice(lastClose + '</think>'.length);
  return tail.includes('<think>') ? '' : tail.trim();
}

function asArgs(value: unknown): Record<string, unknown> {
  const parsed =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return {};
          }
        })()
      : value;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}
