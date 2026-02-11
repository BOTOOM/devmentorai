import React from 'react';
import { AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { EXTENSION_VERSION } from '../version.js';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReportIssue = () => {
    const errorDetails = encodeURIComponent(
      `**Error Message:**\n\`\`\`\n${this.state.error?.message || 'Unknown error'}\n\`\`\`\n\n` +
      `**Stack Trace:**\n\`\`\`\n${this.state.error?.stack || 'No stack trace'}\n\`\`\`\n\n` +
      `**Component Stack:**\n\`\`\`\n${this.state.errorInfo?.componentStack || 'No component stack'}\n\`\`\`\n\n` +
      `**Browser:** ${navigator.userAgent}\n` +
      `**Extension Version:** ${EXTENSION_VERSION}`
    );
    
    const issueUrl = `https://github.com/BOTOOM/devmentorai/issues/new?title=${encodeURIComponent('[Bug] Extension Error')}&body=${errorDetails}&labels=bug,extension`;
    window.open(issueUrl, '_blank');
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Something went wrong
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  DevMentorAI encountered an error
                </p>
              </div>
            </div>

            <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Extension
              </button>

              <button
                onClick={this.handleReportIssue}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Report this Issue
              </button>
            </div>

            <details className="mt-4">
              <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                Technical Details
              </summary>
              <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-40">
                  {this.state.error?.stack}
                </pre>
              </div>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
