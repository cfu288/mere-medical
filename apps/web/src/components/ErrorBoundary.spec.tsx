import { render } from '@testing-library/react';

import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  it('should render successfully', () => {
    const app = render(<ErrorBoundary></ErrorBoundary>);
    expect(app).toBeTruthy();
  });

  it('should catch thrown errors successfully', async () => {
    // Prevent known console.error from dirtying up the test output
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const ThrowError = () => {
      throw new Error('Test Error That Is Caught');
    };
    const component = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const errorText = await component.findByText('Something went wrong');

    expect(errorText).toBeTruthy();
  });
});
