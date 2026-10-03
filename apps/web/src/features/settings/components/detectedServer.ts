import { isOpenAiEndpoint } from '../../patient-context/agent/ollamaChat';

export function detectionFailedLines(endpoint: string): string[] {
  return [
    protocolLine(endpoint),
    'Context window: the server did not answer the detection request, so the app assumes the default window.',
  ];
}

function protocolLine(endpoint: string): string {
  return isOpenAiEndpoint(endpoint)
    ? 'Protocol: OpenAI-compatible (endpoint ends in /v1)'
    : 'Protocol: Ollama';
}

export function detectedServerLines(
  endpoint: string,
  windowTokens: number | null,
): string[] {
  const openAi = isOpenAiEndpoint(endpoint);
  const protocol = protocolLine(endpoint);
  if (windowTokens !== null) {
    return [
      protocol,
      `Context window: ${windowTokens.toLocaleString('en-US')} tokens, reported by the server`,
    ];
  }
  return [
    protocol,
    openAi
      ? 'Context window: not reported by this server, so the app cannot tell when a chat is about to outgrow it.'
      : 'Context window: not reported yet. Ollama reports it once the model is loaded, so send a chat and test again.',
  ];
}
