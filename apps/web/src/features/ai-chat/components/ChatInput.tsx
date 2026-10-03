import { memo, useMemo, useState } from 'react';
import { usePeriodAnimation } from '../../../shared/hooks/usePeriodAnimation';
import { generateRandomQuestion } from '../helpers/generateRandomQuestion';

export const ChatInput = memo(function ChatInput({
  onSubmit,
  onStop,
  isLoadingAiResponse,
}: {
  onSubmit: (message: string) => void;
  onStop: () => void;
  isLoadingAiResponse: boolean;
}) {
  const [message, setMessage] = useState(''),
    periodText = usePeriodAnimation(),
    placeholderText = useMemo(
      () => 'Ask a question (e.g., ' + generateRandomQuestion() + ')',
      [],
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoadingAiResponse || !message.trim()) return;
    const submittedMessage = message.trim();
    setMessage('');
    onSubmit(submittedMessage);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  };

  return (
    <form className="flex-none bg-gray-50" onSubmit={handleSubmit}>
      <div className="flex flex-row items-center p-2 rounded-lg bg-gray-50 justify-center align-middle">
        <input
          id="chat"
          value={message}
          className="block mr-2 h-full p-2.5 w-full text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder={placeholderText}
          onChange={handleMessageChange}
        ></input>
        <button
          type={isLoadingAiResponse ? 'button' : 'submit'}
          onClick={isLoadingAiResponse ? onStop : undefined}
          className={`min-w-24 h-full whitespace-nowrap transition-all text-xs hover:scale-[102%] active:scale-100 shadow-indigo-500/50 hover:shadow-indigo-400/50 shadow-md hover:shadow-lg active:shadow-sm active:shadow-indigo-600/50 bg-indigo-700 text-indigo-50 rounded-md p-2 py-3 font-bold hover:bg-gradient-to-br hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 background-animate`}
        >
          {isLoadingAiResponse ? `■ Stop${periodText}` : `✨ Ask AI`}
          <span className="sr-only">
            {isLoadingAiResponse ? 'Stop the running answer' : 'Send message'}
          </span>
        </button>
      </div>
    </form>
  );
});
