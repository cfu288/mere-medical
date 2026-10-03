import { detectedServerLines, detectionFailedLines } from './detectedServer';

describe('detectedServerLines', () => {
  it('shows the window an OpenAI-compatible server reports', () => {
    expect(detectedServerLines('http://desktop:8000/v1', 49152)).toEqual([
      'Protocol: OpenAI-compatible (endpoint ends in /v1)',
      'Context window: 49,152 tokens, reported by the server',
    ]);
  });

  it('shows the window a loaded Ollama model reports', () => {
    expect(detectedServerLines('http://desktop:11434', 16384)).toEqual([
      'Protocol: Ollama',
      'Context window: 16,384 tokens, reported by the server',
    ]);
  });

  it('explains that Ollama reports the window only once the model is loaded', () => {
    expect(detectedServerLines('http://desktop:11434', null)).toEqual([
      'Protocol: Ollama',
      'Context window: not reported yet. Ollama reports it once the model is loaded, so send a chat and test again.',
    ]);
  });

  it('says when an openai-compatible server such as vllm reports no window for the model', () => {
    expect(detectedServerLines('http://gpu:8000/v1', null)).toEqual([
      'Protocol: OpenAI-compatible (endpoint ends in /v1)',
      'Context window: not reported by this server, so the app cannot tell when a chat is about to outgrow it.',
    ]);
  });

  it('says when the detection request itself failed', () => {
    expect(detectionFailedLines('http://gpu:8000/v1')).toEqual([
      'Protocol: OpenAI-compatible (endpoint ends in /v1)',
      'Context window: the server did not answer the detection request, so the app assumes the default window.',
    ]);
  });
});
