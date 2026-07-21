import ReactMarkdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';

type MarkdownVariant = 'user' | 'assistant' | 'system';

interface MarkdownContentProps {
  content: string;
  variant: MarkdownVariant;
}

/**
 * Renders message content as Markdown for both user and assistant messages.
 *
 * Security: raw HTML is NOT rendered (no `rehype-raw`), so user/LLM-provided
 * Markdown is safe against XSS. Links are forced to open in a new tab with a
 * hardened `rel`.
 */
export function MarkdownContent({ content, variant }: Readonly<MarkdownContentProps>) {
  const isUser = variant === 'user';

  const components: Components = {
    h1: ({ children }) => (
      <h1 className="text-base font-bold mt-3 mb-1.5 first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-base font-bold mt-3 mb-1.5 first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => <h3 className="text-sm font-bold mt-3 mb-1 first:mt-0">{children}</h3>,
    h4: ({ children }) => (
      <h4 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h4>
    ),
    h5: ({ children }) => (
      <h5 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h5>
    ),
    h6: ({ children }) => (
      <h6 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h6>
    ),
    p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
    a: ({ children, href }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={cn(
          'underline underline-offset-2',
          isUser ? 'text-white' : 'text-primary-600 dark:text-primary-400'
        )}
      >
        {children}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="my-1.5 list-disc pl-5 space-y-0.5 first:mt-0 last:mb-0">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-1.5 list-decimal pl-5 space-y-0.5 first:mt-0 last:mb-0">{children}</ol>
    ),
    li: ({ children }) => <li className="[&>ul]:my-1 [&>ol]:my-1">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote
        className={cn(
          'my-1.5 border-l-2 pl-3 italic',
          isUser
            ? 'border-white/40 text-white/90'
            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
        )}
      >
        {children}
      </blockquote>
    ),
    hr: () => (
      <hr
        className={cn(
          'my-2 border-t',
          isUser ? 'border-white/30' : 'border-gray-200 dark:border-gray-700'
        )}
      />
    ),
    code: ({ className, children }) => {
      const text = String(children ?? '');
      const isBlock = /language-/.test(className ?? '') || text.includes('\n');

      if (isBlock) {
        return <code className="font-mono text-xs leading-relaxed whitespace-pre">{children}</code>;
      }

      return (
        <code
          className={cn(
            'px-1.5 py-0.5 rounded text-[0.85em] font-mono break-words',
            isUser ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700'
          )}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-2 p-3 bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg overflow-x-auto max-w-full">
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto">
        <table
          className={cn(
            'w-full text-xs border-collapse',
            isUser ? 'border border-white/30' : 'border border-gray-200 dark:border-gray-700'
          )}
        >
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th
        className={cn(
          'px-2 py-1 text-left font-semibold border',
          isUser
            ? 'border-white/30 bg-white/10'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
        )}
      >
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td
        className={cn(
          'px-2 py-1 border align-top',
          isUser ? 'border-white/30' : 'border-gray-200 dark:border-gray-700'
        )}
      >
        {children}
      </td>
    ),
  };

  return (
    <div className="text-sm min-w-0 max-w-full break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
