'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="flex justify-center">
              <AlertCircle className="w-16 h-16 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Something went wrong</h1>
              <p className="text-muted-foreground mt-2 text-base">
                We encountered an unexpected error. Please try refreshing the page or go back to dashboard.
              </p>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-red-50 border border-red-300 rounded p-3">
                <p className="text-xs font-mono text-red-800 break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="h-12 px-6 text-base"
              >
                Refresh
              </Button>
              <Button
                onClick={this.handleReset}
                className="h-12 px-6 text-base"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
