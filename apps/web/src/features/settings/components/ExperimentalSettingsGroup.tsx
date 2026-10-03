import { Switch } from '@headlessui/react';
import {
  useLocalConfig,
  useUpdateLocalConfig,
} from '../../../app/providers/LocalConfigProvider';
import { classNames } from '../../../shared/utils/StyleUtils';
import { useEffect, useState } from 'react';
import { useNotificationDispatch } from '../../../app/providers/NotificationProvider';
import { isAbortError } from '../../patient-context/agent/abort';
import { testOllamaConnection } from '../../patient-context/agent/ollamaChat';
import { detectContextWindow } from '../../patient-context/agent/contextWindow';
import { detectedServerLines, detectionFailedLines } from './detectedServer';
import {
  AI_DEFAULTS,
  OLLAMA_CHAT_MODELS,
  resolveModelServer,
} from '../../ai-chat/constants/defaults';

export function ExperimentalSettingsGroup() {
  const {
    experimental_features_enabled,
    experimental__openai_api_key,
    experimental__use_openai_rag,
    experimental__ai_provider,
    experimental__ollama_endpoint,
    experimental__ollama_model,
  } = useLocalConfig();
  const updateLocalConfig = useUpdateLocalConfig();
  const [openApiKey, setOpenApiKey] = useState(
    experimental__openai_api_key || '',
  );
  const [ollamaEndpoint, setOllamaEndpoint] = useState(
    experimental__ollama_endpoint || AI_DEFAULTS.OLLAMA.ENDPOINT,
  );
  const [ollamaModel, setOllamaModel] = useState(
    experimental__ollama_model || AI_DEFAULTS.OLLAMA.MODEL,
  );
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const notificationDispatch = useNotificationDispatch();
  const { endpoint, model } = resolveModelServer(useLocalConfig());
  const detectionEnabled =
    experimental_features_enabled &&
    experimental__use_openai_rag &&
    experimental__ai_provider === 'ollama';
  const [detectRequest, setDetectRequest] = useState(0);
  const detectKey = `${endpoint} ${model} ${detectRequest}`;
  const [detected, setDetected] = useState<{
    key: string;
    lines: string[];
  } | null>(null);

  useEffect(() => {
    if (!detectionEnabled) {
      return;
    }
    const abort = new AbortController();
    detectContextWindow({ endpoint, model, signal: abort.signal })
      .then((windowTokens) =>
        setDetected({
          key: detectKey,
          lines: detectedServerLines(endpoint, windowTokens),
        }),
      )
      .catch((error) => {
        if (!isAbortError(error)) {
          setDetected({
            key: detectKey,
            lines: detectionFailedLines(endpoint),
          });
        }
      });
    return () => abort.abort();
  }, [detectionEnabled, detectKey, endpoint, model]);

  if (!experimental_features_enabled) {
    return null;
  }

  return (
    <>
      <h1 className="py-6 text-xl font-extrabold">Experimental</h1>
      <div className="divide-y divide-gray-200">
        <div className="px-4 sm:px-6">
          <ul className="mt-2 ">
            <Switch.Group
              id="experimental__use_ai"
              as="li"
              className="flex flex-col pb-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <Switch.Label
                    as="h2"
                    className="text-primary-800 text-lg leading-6"
                    passive
                  >
                    Enable Mere Assistant
                  </Switch.Label>
                  <Switch.Description className="pt-2 text-sm text-gray-800">
                    The assistant answers questions about your records by
                    searching them with tools. Choose between OpenAI or an
                    Ollama (local) instance.
                  </Switch.Description>
                </div>
                <Switch
                  checked={experimental__use_openai_rag}
                  onChange={() => {
                    updateLocalConfig({
                      experimental__use_openai_rag:
                        !experimental__use_openai_rag,
                    });
                  }}
                  className={classNames(
                    experimental__use_openai_rag
                      ? 'bg-primary-500'
                      : 'bg-gray-200',
                    'focus:ring-primary-500 relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={classNames(
                      experimental__use_openai_rag
                        ? 'translate-x-5'
                        : 'translate-x-0',
                      'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    )}
                  />
                </Switch>
              </div>
            </Switch.Group>

            {experimental__use_openai_rag && (
              <div className="pb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI Provider
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="ollama"
                      checked={
                        experimental__ai_provider === 'ollama' ||
                        !experimental__ai_provider
                      }
                      onChange={() => {
                        updateLocalConfig({
                          experimental__ai_provider: 'ollama' as const,
                        });
                      }}
                      className="mr-2"
                    />
                    Ollama
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="openai"
                      checked={experimental__ai_provider === 'openai'}
                      onChange={() => {
                        updateLocalConfig({
                          experimental__ai_provider: 'openai' as const,
                        });
                      }}
                      className="mr-2"
                    />
                    OpenAI
                  </label>
                </div>
              </div>
            )}

            {/* OpenAI Configuration - only show when OpenAI is selected */}
            {experimental__use_openai_rag &&
              experimental__ai_provider === 'openai' && (
                <>
                  {/* Privacy Warning for OpenAI */}
                  <div className="pb-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                      <p className="text-sm text-amber-700">
                        <b>⚠️ Privacy Notice</b>: By using OpenAI, you will be
                        sending your medical information to OpenAI's servers for
                        processing. This is an experimental option and not
                        recommended for sensitive medical data. OpenAI API keys
                        are stored as plaintext. We recommend using Ollama to
                        keep all data processing local.
                      </p>
                    </div>
                  </div>
                  {/* OpenAI API Key Input */}
                  <form className="w-full flex">
                    <input
                      type="password"
                      className="bg-gray-50 rounded-md p-2 w-full border-none focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent active:ring-2 active:ring-primary-600"
                      placeholder="OpenAI API Key"
                      value={openApiKey}
                      onChange={(e) => {
                        setOpenApiKey(e.target.value);
                      }}
                    />
                    <button
                      type="submit"
                      className="relative ml-4 inline-flex flex-shrink-0 cursor-pointer items-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-sm  hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 disabled:bg-gray-700"
                      onClick={(e) => {
                        e.preventDefault();
                        updateLocalConfig({
                          experimental__openai_api_key: openApiKey,
                        });
                        notificationDispatch({
                          type: 'set_notification',
                          variant: 'success',
                          message: 'OpenAI API Key saved',
                        });
                      }}
                    >
                      Save
                    </button>
                  </form>
                </>
              )}

            {/* Ollama Configuration */}
            {experimental__use_openai_rag &&
              experimental__ai_provider === 'ollama' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ollama Endpoint
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        className="bg-gray-50 rounded-md p-2 flex-1 border-none focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                        placeholder="https://ollama.mari.casa"
                        value={ollamaEndpoint}
                        onChange={(e) => setOllamaEndpoint(e.target.value)}
                      />
                      <button
                        className={classNames(
                          'ml-2 px-4 py-2 text-sm font-bold text-white rounded-md',
                          isTestingConnection
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700',
                        )}
                        onClick={async () => {
                          setIsTestingConnection(true);
                          try {
                            const isConnected = await testOllamaConnection(
                              ollamaEndpoint,
                              openApiKey || undefined,
                            );
                            if (isConnected) {
                              notificationDispatch({
                                type: 'set_notification',
                                variant: 'success',
                                message: 'Successfully connected to Ollama',
                              });
                            } else {
                              notificationDispatch({
                                type: 'set_notification',
                                variant: 'error',
                                message:
                                  'Failed to connect to Ollama. Please check the endpoint.',
                              });
                            }
                          } catch (error) {
                            notificationDispatch({
                              type: 'set_notification',
                              variant: 'error',
                              message: 'Error testing Ollama connection',
                            });
                          } finally {
                            setIsTestingConnection(false);
                            setDetectRequest((n) => n + 1);
                          }
                        }}
                        disabled={isTestingConnection}
                      >
                        {isTestingConnection ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chat Model
                    </label>
                    <input
                      type="text"
                      list="ollama-chat-models"
                      className="bg-gray-50 rounded-md p-2 w-full border-none focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                    />
                    <datalist id="ollama-chat-models">
                      {OLLAMA_CHAT_MODELS.map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </datalist>
                    <p className="text-xs text-gray-500 mt-1">
                      Pick a tested model or type any model your server offers
                    </p>
                  </div>

                  <div className="text-xs text-gray-500">
                    <p className="font-medium text-gray-700">
                      Detected for the saved endpoint and model
                    </p>
                    {detected?.key === detectKey ? (
                      detected.lines.map((line) => <p key={line}>{line}</p>)
                    ) : (
                      <p>Checking…</p>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <button
                      className="bg-primary-600 hover:bg-primary-700 rounded px-4 py-2 font-bold text-white flex-1"
                      onClick={() => {
                        const endpoint =
                          ollamaEndpoint.trim() || AI_DEFAULTS.OLLAMA.ENDPOINT;
                        const model =
                          ollamaModel.trim() || AI_DEFAULTS.OLLAMA.MODEL;
                        setOllamaEndpoint(endpoint);
                        setOllamaModel(model);
                        updateLocalConfig({
                          experimental__ollama_endpoint: endpoint,
                          experimental__ollama_model: model,
                        });
                        notificationDispatch({
                          type: 'set_notification',
                          variant: 'success',
                          message: 'Ollama configuration saved',
                        });
                      }}
                    >
                      Save Ollama Settings
                    </button>
                    <button
                      className="bg-gray-600 hover:bg-gray-700 rounded px-4 py-2 font-bold text-white"
                      onClick={() => {
                        setOllamaEndpoint(AI_DEFAULTS.OLLAMA.ENDPOINT);
                        setOllamaModel(AI_DEFAULTS.OLLAMA.MODEL);

                        updateLocalConfig({
                          experimental__ollama_endpoint:
                            AI_DEFAULTS.OLLAMA.ENDPOINT,
                          experimental__ollama_model: AI_DEFAULTS.OLLAMA.MODEL,
                        });

                        notificationDispatch({
                          type: 'set_notification',
                          variant: 'info',
                          message: 'Ollama settings reset to defaults',
                        });
                      }}
                    >
                      Reset to Defaults
                    </button>
                  </div>
                </div>
              )}
          </ul>
        </div>
      </div>
    </>
  );
}
