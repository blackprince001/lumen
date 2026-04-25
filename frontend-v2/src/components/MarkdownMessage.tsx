import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <div className={cn('text-code leading-[1.75]', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code({ className: cls, children, ...props }: any) {
            const match = /language-(\w+)/.exec(cls || '');
            const language = match?.[1];
            return language ? (
              <SyntaxHighlighter
                style={oneLight}
                language={language}
                PreTag="div"
                customStyle={{ marginTop: '0.75rem', marginBottom: '0.75rem', padding: '1rem', borderRadius: '0.5rem', background: 'var(--muted)', fontSize: '12px' }}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className="bg-[var(--muted)] px-1.5 py-0.5 rounded text-caption" {...props}>
                {children}
              </code>
            );
          },
          p({ children }) { return <p className="mb-3 last:mb-0">{children}</p>; },
          h1({ children }) { return <p className="text-btn font-semibold mb-2 mt-4 first:mt-0">{children}</p>; },
          h2({ children }) { return <p className="text-body font-semibold mb-2 mt-3 first:mt-0">{children}</p>; },
          h3({ children }) { return <p className="text-code font-semibold mb-1.5 mt-2 first:mt-0">{children}</p>; },
          h4({ children }) { return <p className="text-code font-medium mb-1 mt-2 first:mt-0">{children}</p>; },
          h5({ children }) { return <p className="text-code font-medium mb-1 mt-2 first:mt-0">{children}</p>; },
          h6({ children }) { return <p className="text-caption font-medium mb-1 mt-1 first:mt-0">{children}</p>; },
          ul({ children }) { return <ul className="list-disc list-outside mb-3 space-y-1.5 ml-5">{children}</ul>; },
          ol({ children }) { return <ol className="list-decimal list-outside mb-3 space-y-1.5 ml-5">{children}</ol>; },
          li({ children }) { return <li>{children}</li>; },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-[var(--border)] pl-4 my-3 text-[var(--muted-foreground)] italic">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--sky-blue)] underline underline-offset-2 hover:opacity-80 transition-opacity">
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="min-w-full border border-[var(--border)] rounded-lg overflow-hidden text-caption">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="border border-[var(--border)] px-3 py-2 bg-[var(--muted)] font-semibold text-left">{children}</th>;
          },
          td({ children }) {
            return <td className="border border-[var(--border)] px-3 py-2">{children}</td>;
          },
          hr() { return <hr className="my-4 border-[var(--border)]" />; },
          strong({ children }) { return <strong className="font-semibold">{children}</strong>; },
          em({ children }) { return <em className="italic">{children}</em>; },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
