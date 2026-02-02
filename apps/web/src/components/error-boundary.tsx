import { Component, type ReactNode, type ErrorInfo } from "react";
import { Card } from "./ui/card.js";
import { Button } from "./ui/button.js";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-8">
          <Card className="max-w-2xl mx-auto p-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-4">
                <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
              
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Something went wrong
              </h1>
              
              <p className="text-slate-600 dark:text-slate-400">
                An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
              </p>

              {this.state.error && (
                <details className="w-full text-left">
                  <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                    Error details
                  </summary>
                  <div className="mt-2 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 overflow-auto">
                    <p className="font-bold text-red-600 dark:text-red-400">{this.state.error.name}: {this.state.error.message}</p>
                    {this.state.error.stack && (
                      <pre className="mt-2 whitespace-pre-wrap">{this.state.error.stack}</pre>
                    )}
                    {this.state.errorInfo && (
                      <pre className="mt-2 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                    )}
                  </div>
                </details>
              )}

              <Button onClick={this.handleReset} className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Page
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
