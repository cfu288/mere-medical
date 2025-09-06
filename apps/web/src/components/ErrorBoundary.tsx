import React, { PropsWithChildren } from 'react';

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
    return { hasError: true };
  }

  override componentDidCatch(error: Error | unknown, errorInfo: unknown) {
    console.error(error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      if (this.state.fallbackUI) {
        return this.state.fallbackUI;
      }
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
