import { differenceInDays, parseISO } from 'date-fns';
import { UserDocument } from '../../../models/user-document/UserDocument.type';
import { ChatMessage } from '../types/ChatMessage';

const OPEN_AI_MODEL = 'gpt-4o';

export const getOpenAIModels = async (openAiKey: string) => {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error fetching models: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
};

export const callOpenAI = async ({
  query,
  messages,
  openAiKey,
  preparedData,
  streamingMessageCallback,
  user,
  functionCall = 'auto',
}: {
  query: string;
  messages: ChatMessage[];
  openAiKey?: string;
  preparedData: string[];
  streamingMessageCallback?: (message: string) => void;
  user: UserDocument;
  functionCall?: 'auto' | 'none';
}) => {
  const promptMessages = [
    {
      role: 'system',
      content:
        'You are a Physician AI assistant. A patient is asking you a question. Please address the patient directly by name if provided and respond in Markdown format. Use tables when displaying data up to 4 columns. Be concise. If records are missing, use the "search_medical_records" function to find them.',
    },
    {
      role: 'system',
      content: `Demographic information about the patient. Today's Date: ${new Date().toISOString()}
${user?.first_name && user?.last_name ? 'Name: ' + (user?.first_name + ' ' + user?.last_name) : ''}
${user?.birthday ? 'DOB: ' + user?.birthday : ''}
${user?.birthday ? 'Age: ' + (differenceInDays(new Date(), parseISO(user?.birthday)) / 365)?.toFixed(1) : ''}
${user.gender ? 'Gender:' + user?.gender : ''}`,
    },
    ...messages.slice(-10).map((m) => ({
      role: m.user === 'AI' ? 'assistant' : 'user',
      content: m.text,
    })),
    {
      role: 'user',
      content: `The question is: ${query}`,
    },
  ];

  if (preparedData.length > 0) {
    promptMessages.push({
      role: 'system',
      content: `Results of your medical records query. Ignore records not relevant to the question. Data: ${JSON.stringify(preparedData)}`,
    });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: OPEN_AI_MODEL,
      messages: promptMessages,
      functions: [
        {
          name: 'search_medical_records',
          description:
            'Query for additional clinical documents for the current patient. Performs best with specific clinical queries like the name of lab results (e.g CBC, Hemoglobin, Alk Phos) or CCDA section names (e.g. ALLERGIES_AND_INTOLERANCES_SECTION). Returns sections of FHIR or CCDA documents.',
          parameters: {
            type: 'object',
            properties: {
              queries: {
                type: 'array',
                items: {
                  type: 'string',
                  description:
                    'A list of search terms to be executed in parallel. e.g. ["CBC", "CMP", "HBsAg", "SOCIAL_HISTORY", "VITAL_SIGNS"]',
                },
              },
            },
            required: ['queries'],
          },
        },
      ],
      function_call: functionCall,
      stream: true,
    }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let responseText = '';
  let functionName = '';
  let functionArgs = '';

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
        .map((line) => {
          return JSON.parse(line);
        });
      for (const parsedLine of parsedLines) {
        const { choices } = parsedLine;
        const { delta, finish_reason } = choices[0];
        const { content, function_call } = delta;

        if (function_call) {
          if (finish_reason === 'function_call') {
            console.log(
              `Function call: ${functionName} with arguments: ${functionArgs}`,
            );
            break;
          }

          functionName = functionName + (function_call?.name || '');
          functionArgs = functionArgs + (function_call?.arguments || '');
        }

        if (content) {
          if (streamingMessageCallback) {
            streamingMessageCallback(content);
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

  const res: Partial<{
    responseText: string;
    functionCall: {
      name: string | undefined;
      args:
        | {
            queries: string[];
          }
        | undefined;
    };
  }> = {};
  if (responseText) {
    res.responseText = responseText;
  }
  if (functionName) {
    try {
      res.functionCall = {
        name: functionName,
        args: JSON.parse(functionArgs),
      };
    } catch (e) {
      res.functionCall = {
        name: undefined,
        args: undefined,
      };
    }
  }

  return res;
};
