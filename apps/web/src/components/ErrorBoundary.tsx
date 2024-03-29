import React, { PropsWithChildren } from 'react';
import * as Sentry from '@sentry/browser';

export interface ErrorBoundaryState {
  hasError: boolean;
  fallbackUI?: React.ReactNode;
}

type ErrorBoundaryProps = PropsWithChildren<{ fallbackUI?: React.ReactNode }>;

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error | unknown) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  override componentDidCatch(error: Error | unknown, errorInfo: unknown) {
    // You can also log the error to an error reporting service
    console.error(error, errorInfo);
    Sentry.captureException(error);
  }

  override render() {
    if (this.state.hasError) {
      if (this.state.fallbackUI) {
        return this.state.fallbackUI;
      }
      // You can render any custom fallback UI
      return (
        <div className="flex h-screen flex-col items-center justify-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-center">
            Please try reloading the app. If the problem persists, please try
            clearing your browser cache.
          </p>
          <button
            className="bg-primary-500 mt-4 rounded px-4 py-2 text-white"
            onClick={() => {
              window.location.replace(window.location.href);
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
