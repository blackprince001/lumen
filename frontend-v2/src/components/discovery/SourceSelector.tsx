import { cn } from '@/lib/utils';
import { TickCircle as Check } from 'iconsax-reactjs';

export type SourceId = 'arxiv' | 'semantic_scholar' | 'google_scholar' | 'acl' | 'openreview';

interface Source {
  id: SourceId;
  label: string;
}

const SOURCES: Source[] = [
  { id: 'arxiv', label: 'arXiv' },
  { id: 'semantic_scholar', label: 'Semantic Scholar' },
  { id: 'google_scholar', label: 'Google Scholar' },
];

interface SourceSelectorProps {
  selectedSources: SourceId[];
  onChange: (sources: SourceId[]) => void;
  className?: string;
}

export function SourceSelector({ selectedSources, onChange, className }: SourceSelectorProps) {
  const toggleSource = (id: SourceId) => {
    if (selectedSources.includes(id))
    {
      if (selectedSources.length > 1)
      {
        onChange(selectedSources.filter((s) => s !== id));
      }
    } else
    {
      onChange([...selectedSources, id]);
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {SOURCES.map((source) => {
        const isSelected = selectedSources.includes(source.id);
        return (
          <button
            key={source.id}
            type="button"
            onClick={() => toggleSource(source.id)}
            className={cn(
              'h-7 px-3 rounded-full text-caption font-medium transition-all flex items-center gap-1.5 border',
              isSelected
                ? 'bg-[var(--foreground)] text-[var(--white)] border-[var(--foreground)]'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            )}
          >
            {isSelected && <Check size={11} />}
            {source.label}
          </button>
        );
      })}
    </div>
  );
}
