import { AI_DEFAULTS } from '../types';

export const createOllamaEmbeddings = async (
  texts: string[],
  endpoint: string = AI_DEFAULTS.OLLAMA.ENDPOINT,
  model: string = AI_DEFAULTS.OLLAMA.EMBEDDING_MODEL
): Promise<number[][]> => {
  try {
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      const response = await fetch(`${endpoint}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama embedding error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }
      
      embeddings.push(data.embedding);
    }

    return embeddings;
  } catch (error) {
    console.error('Failed to create Ollama embeddings:', error);
    throw error;
  }
};

export const testOllamaConnection = async (
  endpoint: string = AI_DEFAULTS.OLLAMA.ENDPOINT
): Promise<boolean> => {
  try {
    console.log(`[Ollama] Testing connection to: ${endpoint}/api/tags`);
    const response = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    console.log('[Ollama] Test response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('[Ollama] Available models:', data.models?.length || 0);
    }
    
    return response.ok;
  } catch (error) {
    console.error('Ollama connection test failed:', error);
    return false;
  }
};