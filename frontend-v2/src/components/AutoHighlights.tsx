import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Magicpen as Highlighter, Refresh as RefreshCw, Warning2 as AlertCircle, TickCircle as CheckCircle2 } from 'iconsax-reactjs';
import { Button } from '@/components/ui/Button';
import { aiFeaturesApi } from '@/lib/api/aiFeatures';
// import { cn } from '@/lib/utils';

interface AutoHighlightsProps {
  paperId: number;
}

export function AutoHighlights({ paperId }: AutoHighlightsProps) {
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: () => aiFeaturesApi.generateHighlights(paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', paperId] });
      queryClient.invalidateQueries({ queryKey: ['paper', paperId] });
    },
  });

  return (
    <div className="p-5 bg-[var(--sky-blue)]/5 border border-[var(--sky-blue)]/20 rounded-2xl">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <Highlighter size={16} className="text-[var(--sky-blue)]" />
          <h4 className="text-body font-bold">Auto-Highlights</h4>
        </div>
        <Button
          variant="outlined"
          className="h-8 text-caption px-3 border-[var(--sky-blue)]/30 hover:bg-[var(--sky-blue)]/10 text-[var(--sky-blue)]"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            "Run AI Agent"
          )}
        </Button>
      </div>

      <p className="text-caption text-[var(--muted-foreground)] leading-relaxed">
        Let AI analyze the paper and automatically highlight core methods, results, and key contributions for you.
      </p>

      {generateMutation.isSuccess && generateMutation.data && (
        <div className="mt-4 flex items-center gap-2 text-caption text-[var(--success-green)] font-medium animate-in fade-in slide-in-from-top-1 duration-300">
          <CheckCircle2 size={14} />
          <span>Success! {generateMutation.data.count} highlights identified and added.</span>
        </div>
      )}

      {generateMutation.isError && (
        <div className="mt-4 p-3 bg-[var(--destructive)]/5 border border-[var(--destructive)]/20 rounded-xl flex items-start gap-3">
          <AlertCircle size={14} className="text-[var(--destructive)] shrink-0 mt-0.5" />
          <div>
            <p className="text-caption font-bold text-[var(--destructive)] uppercase tracking-tight">AI Agent Failed</p>
            <p className="text-caption text-[var(--destructive)]/80 mt-0.5">
              {generateMutation.error instanceof Error ? generateMutation.error.message : 'Server error'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
