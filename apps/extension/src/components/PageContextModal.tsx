import { Check, Copy, ExternalLink, FileText, Globe, Link2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getBestActiveTab } from '../lib/browser-utils';

interface PageContext {
  url: string;
  title: string;
  selectedText?: string;
}

interface PageContextModalProps {
  onClose: () => void;
  onUseInChat: (context: PageContext) => void;
}

export function PageContextModal({ onClose, onUseInChat }: Readonly<PageContextModalProps>) {
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchPageContext();
  }, []);

  const fetchPageContext = async () => {
    setIsLoading(true);
    try {
      // Get active tab
      const tab = await getBestActiveTab();

      if (tab?.id) {
        // Get page context from content script
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });

        setPageContext({
          url: response?.url || tab.url || '',
          title: response?.title || tab.title || '',
          selectedText: response?.selectedText || undefined,
        });
      }
    } catch (error) {
      console.error('Failed to get page context:', error);
      // Fallback to tab info only
      const tab = await getBestActiveTab();
      setPageContext({
        url: tab?.url || '',
        title: tab?.title || '',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleUseInChat = () => {
    if (pageContext) {
      onUseInChat(pageContext);
      onClose();
    }
  };

  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  } else if (pageContext) {
    content = (
      <>
        {/* Title */}
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            <FileText className="w-3.5 h-3.5" />
            Page Title
          </p>
          <p className="text-sm text-gray-900 dark:text-white font-medium line-clamp-2">
            {pageContext.title || '(No title)'}
          </p>
        </div>

        {/* URL */}
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            <Link2 className="w-3.5 h-3.5" />
            URL
          </p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-600 dark:text-gray-300 break-all line-clamp-2 flex-1">
              {pageContext.url}
            </p>
            <div className="flex gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => copyToClipboard(pageContext.url)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Copy URL"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <a
                href={pageContext.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Selected Text */}
        {pageContext.selectedText && (
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Selected Text ({pageContext.selectedText.length} chars)
            </p>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-4">
                {pageContext.selectedText}
              </p>
            </div>
          </div>
        )}
      </>
    );
  } else {
    content = (
      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
        Unable to get page information
      </p>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Current Page</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">{content}</div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleUseInChat}
            disabled={!pageContext}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Use in Chat
          </button>
        </div>
      </div>
    </div>
  );
}
