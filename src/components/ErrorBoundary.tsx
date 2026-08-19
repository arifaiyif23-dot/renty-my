import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RotateCcw, Home, Bug, RefreshCw } from 'lucide-react';
import { logBoundaryError } from '@/lib/errorLogger';
import i18n from '@/i18n/config';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  componentStack?: string;
  countdown: number;
  reported: boolean;
}

const AUTO_RETRY_DELAY = 30;

export default class ErrorBoundary extends Component<Props, State> {
  timer: ReturnType<typeof setInterval> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, countdown: AUTO_RETRY_DELAY, reported: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: undefined, countdown: AUTO_RETRY_DELAY, reported: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ componentStack: errorInfo.componentStack ?? '' });
    logBoundaryError(error, errorInfo.componentStack ?? '');
    this.startAutoRetry();
  }

  componentWillUnmount() {
    this.clearAutoRetry();
  }

  t = (key: string) => i18n.t(key);

  startAutoRetry = () => {
    this.clearAutoRetry();
    this.timer = setInterval(() => {
      this.setState((prev) => {
        if (prev.countdown <= 1) {
          this.clearAutoRetry();
          this.handleRetry();
          return { countdown: 0 };
        }
        return { countdown: prev.countdown - 1 };
      });
    }, 1000);
  };

  clearAutoRetry = () => {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  };

  handleReset = () => {
    this.clearAutoRetry();
    this.setState({ hasError: false, error: undefined, countdown: AUTO_RETRY_DELAY, reported: false });
  };

  handleRetry = () => {
    this.clearAutoRetry();
    this.setState({ hasError: false, error: undefined, countdown: AUTO_RETRY_DELAY, reported: false });
    window.location.reload();
  };

  handleGoHome = () => {
    this.clearAutoRetry();
    this.setState({ hasError: false, error: undefined, countdown: AUTO_RETRY_DELAY, reported: false });
    window.location.href = '/';
  };

  handleReport = async () => {
    if (this.state.error) {
      await logBoundaryError(this.state.error, this.state.componentStack ?? '');
      this.setState({ reported: true });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, countdown, reported } = this.state;

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {this.t('errorBoundary.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {this.t('errorBoundary.autoRetry')} <span className="font-mono font-bold">{countdown}</span>{this.t('errorBoundary.seconds')}
              </p>
              <p className="text-xs text-muted-foreground">
                {this.t('errorBoundary.reportHint')}
              </p>
              {error && (
                <details className="text-xs text-muted-foreground bg-muted p-3 rounded">
                  <summary className="cursor-pointer font-medium mb-2">{this.t('errorBoundary.errorDetails')}</summary>
                  <pre className="overflow-auto break-words whitespace-pre-wrap">{error.message}</pre>
                </details>
              )}
              <div className="flex flex-col gap-2">
                <Button onClick={this.handleRetry} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {this.t('errorBoundary.tryAgain')}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={this.handleReset} variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {this.t('errorBoundary.dismiss')}
                  </Button>
                  <Button onClick={this.handleGoHome} variant="outline">
                    <Home className="h-4 w-4 mr-2" />
                    {this.t('errorBoundary.home')}
                  </Button>
                </div>
                <Button
                  onClick={this.handleReport}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  disabled={reported}
                >
                  <Bug className="h-4 w-4 mr-2" />
                  {reported ? this.t('errorBoundary.reported') : this.t('errorBoundary.reportError')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
