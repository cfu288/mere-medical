import { render, screen } from '@testing-library/react';

import { MessageBubble } from './MessageBubble';

jest.mock('../../../app/providers/UserProvider', () => ({
  useUser: () => ({ id: 'user-1' }),
}));

describe('MessageBubble', () => {
  it('renders markdown in an answer without loading images', () => {
    const { container } = render(
      <MessageBubble
        message={{
          type: 'ai',
          id: 'm1',
          text: 'Your **hemoglobin** is 16.1 ![chart](https://evil.example/log?hb=16.1)',
          timestamp: new Date('2025-01-01T00:00:00Z'),
        }}
      />,
    );

    expect(screen.getByText('hemoglobin').tagName).toEqual('STRONG');
    expect(container.querySelector('img')).toBeNull();
  });
});
