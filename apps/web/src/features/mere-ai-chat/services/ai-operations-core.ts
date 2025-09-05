import {
  AIProviderConfig,
  AI_DEFAULTS,
} from '../types';
import { AI_CONFIG } from '../constants/config';

interface AIOperationParams extends AIProviderConfig {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  expectJson?: boolean;
  streamingCallback?: (message: string) => void;
  useRerankingModel?: boolean;
}

export async function callAIProvider({
  aiProvider,
  systemPrompt,
  userPrompt,
  temperature = AI_CONFIG.TEMPERATURE.DETERMINISTIC,
  expectJson = true,
  streamingCallback,
  openAiKey,
  ollamaEndpoint = AI_DEFAULTS.OLLAMA.ENDPOINT,
  ollamaModel = AI_DEFAULTS.OLLAMA.MODEL,
  ollamaRerankModel,
  useRerankingModel = false,
}: AIOperationParams): Promise<any> {
  let model: string;
  if (aiProvider === 'openai') {
    model = useRerankingModel
      ? AI_DEFAULTS.OPENAI.RERANK_MODEL
      : AI_DEFAULTS.OPENAI.MODEL;
  } else {
    // Use dedicated reranking model if available and requested
    if (useRerankingModel && ollamaRerankModel) {
      model = ollamaRerankModel;
      console.log(`[Ollama] Using dedicated reranking model: ${model}`);
    } else {
      model = ollamaModel;
    }
  }

  // For Ollama reranking, check if we should skip based on model configuration
  if (
    aiProvider === 'ollama' &&
    useRerankingModel &&
    (!ollamaRerankModel || ollamaRerankModel === '') &&
    expectJson
  ) {
    console.log(
      `[Ollama] No dedicated reranking model configured, skipping reranking`,
    );
    return [];
  }

  if (aiProvider === 'openai') {
    if (!openAiKey) {
      throw new Error('OpenAI API key is required');
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: !!streamingCallback,
        response_format: expectJson ? { type: 'json_object' } : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    if (streamingCallback) {
      if (!response.body) {
        throw new Error('OpenAI API error: response body is null.');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullResponse = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                streamingCallback(content);
                fullResponse += content;
              }
            } catch (e) {
              // Skip malformed JSON chunks in streaming response
              console.debug('Skipping malformed streaming chunk:', data);
            }
          }
        }
      }
      return expectJson ? JSON.parse(fullResponse) : fullResponse;
    } else {
      const data = await response.json();
      const content = data.choices[0].message.content;
      return expectJson ? JSON.parse(content) : content;
    }
  } else {
    // Use chat endpoint for better structured output support
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await fetch(`${ollamaEndpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: !!streamingCallback,
        // Use format: 'json' when expecting JSON output
        // Reranking models should support this
        format: expectJson ? 'json' : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    if (streamingCallback) {
      if (!response.body) {
        throw new Error('Ollama API error: response body is null.');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullResponse = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim() !== '');
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            // Chat endpoint uses message.content instead of response
            const content = parsed.message?.content || parsed.response;
            if (content) {
              streamingCallback(content);
              fullResponse += content;
            }
          } catch (e) {
            // Skip malformed JSON chunks in Ollama streaming response
            console.debug('Skipping malformed Ollama streaming chunk:', line);
          }
        }
      }
      if (expectJson) {
        try {
          return JSON.parse(fullResponse);
        } catch (error) {
          console.error(
            '[Ollama] Failed to parse streaming JSON response:',
            fullResponse.substring(0, 200),
          );
          // Try to extract JSON from the response
          const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              return JSON.parse(jsonMatch[0]);
            } catch {
              console.error(
                '[Ollama] Could not extract valid JSON from streaming response',
              );
              throw new Error('Ollama returned invalid JSON response');
            }
          }
          throw new Error(
            'Ollama did not return JSON despite format: json being set',
          );
        }
      }
      return fullResponse;
    } else {
      // For non-streaming requests, we get a single response
      const data = await response.json();
      // Chat endpoint uses message.content, generate uses response
      const fullResponse = data.message?.content || data.response || '';
      if (expectJson) {
        try {
          return JSON.parse(fullResponse);
        } catch (error) {
          console.warn(
            '[Ollama] Failed to parse non-streaming JSON response:',
            fullResponse.substring(0, 200),
          );
          // Try to extract JSON from the response
          const jsonMatch = fullResponse.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              return JSON.parse(jsonMatch[0]);
            } catch {
              console.warn(
                '[Ollama] Could not extract valid JSON from non-streaming response',
              );
              // Return empty array as fallback for reranking
              return [];
            }
          }
          console.warn(
            '[Ollama] No JSON found in response, returning empty array as fallback',
          );
          // Return empty array as fallback for reranking
          return [];
        }
      }
      return fullResponse;
    }
  }
}
