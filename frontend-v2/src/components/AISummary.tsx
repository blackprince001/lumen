import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MagicStar as Sparkles, Edit as Edit2, Save2 as Save, Refresh as RefreshCw, Warning2 as AlertCircle } from 'iconsax-reactjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { aiFeaturesApi } from '@/lib/api/aiFeatures';
import { cn } from '@/lib/utils';

interface AISummaryProps {
  paperId: number;
}

export function AISummary({ paperId }: AISummaryProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['ai-summary', paperId],
    queryFn: () => aiFeaturesApi.getSummary(paperId),
    retry: 1,
  });

  const generateMutation = useMutation({
    mutationFn: () => aiFeaturesApi.generateSummary(paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-summary', paperId] });
      queryClient.invalidateQueries({ queryKey: ['paper', paperId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (summaryText: string) => aiFeaturesApi.updateSummary(paperId, summaryText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-summary', paperId] });
      setEditing(false);
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-[var(--muted-foreground)] animate-pulse">
        <Sparkles size={24} className="mb-2 opacity-50" />
        <p className="text-code">Reading paper...</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <Textarea
          value={editedSummary}
          onChange={(e) => setEditedSummary(e.target.value)}
          rows={12}
          className="w-full text-code bg-[var(--white)]"
          placeholder="Enter AI summary..."
          autoFocus
        />
        <div className="flex items-center gap-2">
          <Button
            className="h-8 text-caption"
            onClick={() => updateMutation.mutate(editedSummary)}
            disabled={updateMutation.isPending}
          >
            <Save size={14} className="mr-1.5" />
            Save Changes
          </Button>
          <Button
            variant="ghost"
            className="h-8 text-caption"
            onClick={() => {
              setEditing(false);
              setEditedSummary(summary?.summary || '');
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {summary?.summary ? (
        <>
          <div className="prose prose-sm max-w-none prose-p:text-body prose-p:leading-relaxed prose-p:text-[var(--foreground)] prose-headings:text-[var(--foreground)] prose-strong:text-[var(--foreground)] prose-li:text-[var(--foreground)]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                h1: ({ children }) => <h1 className="text-subheading font-bold mt-6 mb-3 first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="text-body-lg font-bold mt-5 mb-2 first:mt-0">{children}</h2>,
                h3: ({ children }) => <h3 className="text-body font-bold mt-4 mb-2 first:mt-0">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="marker:text-[var(--muted-foreground)]">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-[var(--border)] pl-4 italic my-4 text-[var(--muted-foreground)]">
                    {children}
                  </blockquote>
                ),
                code: ({ className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const inline = !match;
                  return inline ? (
                    <code className="bg-[var(--muted)] px-1 py-0.5 rounded text-caption" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className="block bg-[var(--muted)] p-3 rounded-lg text-caption overflow-x-auto my-4 border border-[var(--border)]" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {summary.summary}
            </ReactMarkdown>
          </div>
          
          <div className="flex items-center gap-2 pt-4 border-t border-[var(--border)]">
            <Button
              variant="ghost"
              className="h-8 text-caption px-3"
              onClick={() => {
                setEditedSummary(summary.summary);
                setEditing(true);
              }}
            >
              <Edit2 size={13} className="mr-1.5" />
              Edit
            </Button>
            <Button
              variant="outlined"
              className="h-8 text-caption px-3 ml-auto border-[var(--sky-blue)]/30 hover:bg-[var(--sky-blue)]/10 text-[var(--sky-blue)]"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              <RefreshCw size={13} className={cn("mr-1.5", generateMutation.isPending && "animate-spin")} />
              {generateMutation.isPending ? 'Generating...' : 'Regenerate'}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-[var(--muted)]/20 rounded-2xl border border-dashed border-[var(--border)]">
          <Sparkles size={32} className="mb-4 text-[var(--muted-foreground)] opacity-40" />
          <h3 className="text-btn font-semibold text-[var(--foreground)] mb-2">No Summary Available</h3>
          <p className="text-code text-[var(--muted-foreground)] mb-6 max-w-[15rem]">
            Generate an AI-powered summary to quickly understand the core message of this paper.
          </p>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-6"
          >
            {generateMutation.isPending ? (
              <>
                <RefreshCw size={16} className="mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles size={16} className="mr-2" />
                Generate Summary
              </>
            )}
          </Button>
        </div>
      )}

      {(generateMutation.isError || error) && (
        <div className="p-4 bg-[var(--destructive)]/5 border border-[var(--destructive)]/20 rounded-xl flex items-start gap-3">
          <AlertCircle size={16} className="text-[var(--destructive)] shrink-0 mt-0.5" />
          <div>
            <p className="text-caption font-semibold text-[var(--destructive)]">Something went wrong</p>
            <p className="text-caption text-[var(--destructive)]/80 mt-1 uppercase">
              {generateMutation.error instanceof Error ? generateMutation.error.message : 'Server error'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
