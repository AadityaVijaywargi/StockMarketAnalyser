import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background min-h-screen">
          <div className="max-w-md w-full bg-surface border border-borderDark rounded-2xl p-6 shadow-premium flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-bearish/10 border border-bearish/25 flex items-center justify-center text-bearish">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <h2 className="text-lg font-bold text-white font-sans">Dashboard Render Failure</h2>
            
            <p className="text-xs text-textMuted leading-relaxed font-sans max-w-sm">
              An unexpected error occurred while rendering the analysis view. This is usually due to a missing or invalid field in the API payload.
            </p>

            {this.state.error && (
              <pre className="w-full bg-background border border-borderDark p-3 rounded-lg text-left text-[10px] font-mono text-bearish overflow-x-auto max-h-40">
                {this.state.error.name}: {this.state.error.message}
                {"\n"}
                {this.state.error.stack}
              </pre>
            )}

            <button
              onClick={() => window.location.reload()}
              className="mt-2 bg-brand hover:bg-brand/90 text-white font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-brand/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
