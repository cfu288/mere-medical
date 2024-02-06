import { differenceInDays, parseISO } from 'date-fns';
import { UserDocument } from '../../../models/user-document/UserDocument.type';
import { ChatMessage } from '../types/ChatMessage';

export const callOpenAI = async ({
  query,
  messages,
  openAiKey,
  preparedData,
  streamingCallback,
  user,
}: {
  query: string;
  messages: ChatMessage[];
  openAiKey?: string;
  preparedData: string[];
  streamingCallback?: (message: string) => void;
  user: UserDocument;
}) => {
  const promptMessages = [
    {
      role: 'system',
      content:
        'You are a medical AI assistant. A patient is asking you a question. Please address the patient directly by name if provided and respond in Markdown format. Use tables when displaying data up to 4 columns. Be concise.',
    },
    {
      role: 'system',
      content: `Demographic information about the patient.
Today's Date: ${new Date().toISOString()};
${user?.first_name && user?.last_name ? 'Name: ' + (user?.first_name + ' ' + user?.last_name) : ''}
${user?.birthday ? 'DOB: ' + user?.birthday : ''}
${user?.birthday ? 'Age: ' + (differenceInDays(new Date(), parseISO(user?.birthday)) / 365)?.toFixed(1) : ''}
${user.gender ? 'Gender:' + user?.gender : ''}`,
    },
    ...messages.slice(-5).map((m) => ({
      role: m.user === 'AI' ? 'assistant' : 'user',
      content: m.text,
    })),
    {
      role: 'user',
      content: `The question is: ${query}`,
    },
    {
      role: 'system',
      content: `Subset of medical records you found that may help answer the question. Ignore records not relevant to the question.
Data: ${JSON.stringify(preparedData, null, 2)}`,
    },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      // model: 'gpt-3.5-turbo-16k',
      messages: promptMessages,
      stream: true,
    }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let responseText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      const parsedLines = lines
        .map((line) => line.replace(/^data: /, '').trim())
        .filter((line) => line !== '' && line !== '[DONE]')
        .map((line) => JSON.parse(line));
      for (const parsedLine of parsedLines) {
        const { choices } = parsedLine;
        const { delta } = choices[0];
        const { content } = delta;

        if (content) {
          if (streamingCallback) {
            streamingCallback(content);
          }
          responseText += content;
        }
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    reader.releaseLock();
  }

  console.log(responseText);

  return responseText;
};
