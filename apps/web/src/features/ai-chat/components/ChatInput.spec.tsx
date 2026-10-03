import { fireEvent, render, screen } from '@testing-library/react';

import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  it('submits the trimmed message and clears the input', () => {
    const onSubmit = jest.fn();
    render(
      <ChatInput
        onSubmit={onSubmit}
        onStop={jest.fn()}
        isLoadingAiResponse={false}
      />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: '  what are my allergies?  ' },
    });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledWith('what are my allergies?');
    expect(input.value).toEqual('');
  });

  it('keeps the draft when submitted while an answer is running', () => {
    const onSubmit = jest.fn();
    render(
      <ChatInput
        onSubmit={onSubmit}
        onStop={jest.fn()}
        isLoadingAiResponse={true}
      />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'and my medications?' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.value).toEqual('and my medications?');
  });
});
