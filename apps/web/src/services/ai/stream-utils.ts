export interface StreamHandler {
  onChunk: (chunk: string) => void;
  parseChunk: (line: string) => string | null;
}

/**
 * Generic stream reader for AI provider responses
 */
export async function readStream(
  response: Response,
  handler: StreamHandler,
): Promise<string> {
  if (!response.body) {
    throw new Error('Response body is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullResponse = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;

        const content = handler.parseChunk(line);
        if (content) {
          fullResponse += content;
          handler.onChunk(content);
        }
      }
    }

    if (buffer.trim()) {
      const content = handler.parseChunk(buffer);
      if (content) {
        fullResponse += content;
        handler.onChunk(content);
      }
    }

    return fullResponse;
  } finally {
    reader.releaseLock();
  }
}

/**
 * OpenAI-specific chunk parser
 */
export function parseOpenAIChunk(line: string): string | null {
  if (line.startsWith('data: ')) {
    const data = line.slice(6);
    if (data === '[DONE]') return null;

    try {
      const parsed = JSON.parse(data);
      return parsed.choices?.[0]?.delta?.content || null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Ollama-specific chunk parser
 */
export function parseOllamaChunk(line: string): string | null {
  try {
    const data = JSON.parse(line);
    return data.message?.content || data.response || null;
  } catch {
    return null;
  }
}
