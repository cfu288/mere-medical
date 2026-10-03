import { isAbortError } from './abort';
import { z } from 'zod';

import { MAX_COMPLETION_TOKENS } from '../constants';
import { isOpenAiEndpoint } from './ollamaChat';

const DETECT_TIMEOUT_MS = 20_000;

export type ContextBudget = { windowTokens: number; tokensPerChar: number };

const openAiModels = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      max_model_len: z.number().int().positive().optional(),
    }),
  ),
});

const ollamaLoaded = z.object({
  models: z.array(
    z.object({
      name: z.string(),
      context_length: z.number().int().positive().optional(),
    }),
  ),
});

export async function detectContextWindow({
  endpoint,
  model,
  apiKey,
  signal,
}: {
  endpoint: string;
  model: string;
  apiKey?: string;
  signal?: AbortSignal;
}): Promise<number | null> {
  const openAi = isOpenAiEndpoint(endpoint);
  const url = openAi
    ? `${endpoint.replace(/\/$/, '')}/models`
    : `${endpoint}/api/ps`;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, DETECT_TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    if (openAi) {
      const parsed = openAiModels.safeParse(body);
      return parsed.success
        ? parsed.data.data.find((m) => m.id === model)?.max_model_len ?? null
        : null;
    }
    const parsed = ollamaLoaded.safeParse(body);
    return parsed.success
      ? parsed.data.models.find((m) => m.name === model)?.context_length ?? null
      : null;
  } catch (e) {
    if (isAbortError(e) && !timedOut) {
      throw e;
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function measureBudget(
  windowTokens: number | null,
  promptTokens: number | null,
  promptChars: number,
): ContextBudget | null {
  if (windowTokens === null || promptTokens === null || promptChars <= 0) {
    return null;
  }
  return { windowTokens, tokensPerChar: promptTokens / promptChars };
}

export function fitsWithAnswer(
  budget: ContextBudget | null,
  promptChars: number,
): boolean {
  return (
    budget === null ||
    promptChars * budget.tokensPerChar + MAX_COMPLETION_TOKENS <=
      budget.windowTokens
  );
}
