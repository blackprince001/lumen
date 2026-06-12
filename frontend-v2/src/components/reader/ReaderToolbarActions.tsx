import { useState } from 'react';
import { Bookmark, Moon, Sun1 as Sun, Magicpen as HighlighterIcon, Share } from 'iconsax-reactjs';
import { papersApi, type Paper } from '@/lib/api/papers';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { canAnnotate, isOwner } from '@/lib/utils/permissions';
import { toastError, toastSuccess } from '@/lib/utils/toast';
import { cn } from '@/lib/utils';
import type { ThemeName } from '@/lib/paper-themes';
import { ShareDialog } from '@/components/ShareDialog';
import { THEME_NAMES } from './highlight-colors';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'Reading' },
  { value: 'read', label: 'Read' },
  { value: 'archived', label: 'Archived' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

/** Reading status / priority / bookmark / dark-mode / highlighter / share toolbar cluster. */
export function ReaderToolbarActions({
  paper,
  currentPage,
  isDark,
  highlighterActive,
  highlighterColor,
  onToggleDark,
  onToggleHighlighter,
  onHighlighterColorChange,
  onPaperChanged,
}: {
  paper: Paper;
  currentPage: number;
  isDark: boolean;
  highlighterActive: boolean;
  highlighterColor: ThemeName;
  onToggleDark: () => void;
  onToggleHighlighter: () => void;
  onHighlighterColorChange: (color: ThemeName) => void;
  onPaperChanged: () => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);

  const handleStatus = async (status: string) => {
    try {
      await papersApi.updateReadingStatus(paper.id, status as Paper['reading_status'] & string);
      onPaperChanged();
    } catch {
      toastError('Failed to update reading status');
    }
  };

  const handlePriority = async (priority: string) => {
    try {
      await papersApi.updatePriority(paper.id, priority as Paper['priority'] & string);
      onPaperChanged();
    } catch {
      toastError('Failed to update priority');
    }
  };

  const handleBookmark = async () => {
    if (!canAnnotate(paper)) return;
    try {
      await papersApi.createBookmark(paper.id, currentPage);
      toastSuccess(`Bookmarked page ${currentPage}`);
      onPaperChanged();
    } catch {
      toastError('Failed to add bookmark');
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {canAnnotate(paper) && (
        <>
          <Tooltip content={highlighterActive ? 'Disable highlighter' : 'Highlighter'} side="bottom">
            <button
              type="button"
              onClick={onToggleHighlighter}
              aria-label="Toggle highlighter"
              className={cn(
                'flex size-7 items-center justify-center rounded-md transition-colors hover:bg-(--secondary)',
                highlighterActive
                  ? 'bg-(--secondary) text-(--foreground)'
                  : 'text-(--muted-foreground) hover:text-(--foreground)',
              )}
            >
              <HighlighterIcon size={15} />
            </button>
          </Tooltip>
          {highlighterActive && (
            <div className="flex items-center gap-0.5 rounded-md border border-(--border) bg-(--card) px-1 py-0.5">
              {THEME_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onHighlighterColorChange(name)}
                  className={cn(
                    'size-4 rounded-full border transition-transform',
                    name === highlighterColor ? 'scale-125 ring-1 ring-(--foreground)' : 'hover:scale-110',
                  )}
                  style={{ backgroundColor: `var(--theme-${name}-action)` }}
                  aria-label={name}
                />
              ))}
            </div>
          )}
        </>
      )}
      {isOwner(paper) && (
        <Tooltip content="Share paper" side="bottom">
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-label="Share paper"
            className="flex size-7 items-center justify-center rounded-md text-(--muted-foreground) transition-colors hover:bg-(--secondary) hover:text-(--foreground)"
          >
            <Share size={15} />
          </button>
        </Tooltip>
      )}
      <Select
        value={paper.reading_status ?? 'not_started'}
        onChange={(event) => void handleStatus(event.target.value)}
        className="h-7 w-28 text-caption"
        aria-label="Reading status"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        value={paper.priority ?? 'low'}
        onChange={(event) => void handlePriority(event.target.value)}
        className="h-7 w-24 text-caption"
        aria-label="Priority"
      >
        {PRIORITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {canAnnotate(paper) && (
        <Tooltip content={`Bookmark page ${currentPage}`} side="bottom">
          <button
            type="button"
            onClick={() => void handleBookmark()}
            aria-label="Bookmark current page"
            className="flex size-7 items-center justify-center rounded-md text-(--muted-foreground) transition-colors hover:bg-(--secondary) hover:text-(--foreground)"
          >
            <Bookmark size={15} />
          </button>
        </Tooltip>
      )}
      <Tooltip content={isDark ? 'Light document' : 'Dark document'} side="bottom">
        <button
          type="button"
          onClick={onToggleDark}
          aria-label="Toggle document dark mode"
          className={cn(
            'flex size-7 items-center justify-center rounded-md transition-colors hover:bg-(--secondary)',
            isDark ? 'text-(--foreground)' : 'text-(--muted-foreground) hover:text-(--foreground)',
          )}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </Tooltip>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        resourceId={paper.id}
        resourceType="paper"
        resourceTitle={paper.title}
      />
    </div>
  );
}
