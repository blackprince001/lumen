import { SearchZoomIn as ZoomIn, SearchZoomOut as ZoomOut, MenuBoard as List, ArrowLeft2 as ChevronLeft, ArrowRight2 as ChevronRight, ArrowLeft3 as ChevronsLeft, ArrowRight3 as ChevronsRight, DocumentDownload as Download, Bookmark, ArrowRotateRight as RotateCw, Magicpen as Highlighter, PenTool as PenLine } from 'iconsax-reactjs';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

interface PDFToolbarProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  currentPage: number;
  numPages: number | null;
  onPageChange: (page: number) => void;
  onFirstPage: () => void;
  onLastPage: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  showTOC: boolean;
  onTOCToggle: () => void;
  rotation: number;
  onRotationChange: (rotation: number) => void;
  highlightMode: boolean;
  onHighlightModeToggle: () => void;
  onNoteAction?: () => void;
  paperId: number;
  readingStatus?: 'not_started' | 'in_progress' | 'read' | 'archived';
  onReadingStatusChange?: (status: 'not_started' | 'in_progress' | 'read' | 'archived') => void;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  onPriorityChange?: (priority: 'low' | 'medium' | 'high' | 'critical') => void;
  onBookmarkAdd?: () => void;
  onDownload?: () => void;
}

export function PDFToolbar({
  zoom,
  onZoomChange,
  currentPage,
  numPages,
  onPageChange,
  onFirstPage,
  onLastPage,
  onPreviousPage,
  onNextPage,
  showTOC,
  onTOCToggle,
  rotation,
  onRotationChange,
  highlightMode,
  onHighlightModeToggle,
  onNoteAction,
  readingStatus,
  onReadingStatusChange,
  priority,
  onPriorityChange,
  onBookmarkAdd,
  onDownload
}: PDFToolbarProps) {

  const handleZoomIn = () => onZoomChange(Math.min(zoom + 0.25, 3));
  const handleZoomOut = () => onZoomChange(Math.max(zoom - 0.25, 0.5));
  const handleZoomReset = () => onZoomChange(1);

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 1 && val <= (numPages || 1)) {
      onPageChange(val);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--white)] shrink-0 z-20 overflow-x-auto scrollbar-none">
      {/* TOC toggle */}
      <div className="flex items-center gap-1 border-r border-[var(--border)] pr-2 shrink-0">
        <Tooltip content={showTOC ? "Hide Table of Contents" : "Show Table of Contents"} side="bottom">
          <Button
            variant="ghost"
            className={cn(
              "h-8 w-8 p-0 hover:bg-[var(--foreground)]/[0.08]",
              showTOC && "bg-[var(--foreground)]/[0.08] text-[var(--foreground)]"
            )}
            onClick={onTOCToggle}
          >
            <List size={16} />
          </Button>
        </Tooltip>
      </div>

      {/* Page Navigation */}
      <div className="flex items-center gap-1 border-r border-[var(--border)] pr-2 shrink-0">
        <Tooltip content="First Page" side="bottom">
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-[var(--foreground)]/[0.08]"
            disabled={currentPage <= 1}
            onClick={onFirstPage}
          >
            <ChevronsLeft size={16} />
          </Button>
        </Tooltip>
        <Tooltip content="Previous Page" side="bottom">
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-[var(--foreground)]/[0.08]"
            disabled={currentPage <= 1}
            onClick={onPreviousPage}
          >
            <ChevronLeft size={16} />
          </Button>
        </Tooltip>

        <div className="flex items-center gap-1 px-1">
          <input
            type="number"
            value={currentPage}
            onChange={handlePageInput}
            className="w-12 h-7 bg-[var(--muted)] border border-[var(--border)] rounded text-code text-center focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]"
            min={1}
            max={numPages || 1}
          />
          <span className="text-caption text-[var(--muted-foreground)] whitespace-nowrap">
            / {numPages || '?'}
          </span>
        </div>

        <Tooltip content="Next Page" side="bottom">
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-[var(--foreground)]/[0.08]"
            disabled={currentPage >= (numPages || 1)}
            onClick={onNextPage}
          >
            <ChevronRight size={16} />
          </Button>
        </Tooltip>
        <Tooltip content="Last Page" side="bottom">
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-[var(--foreground)]/[0.08]"
            disabled={currentPage >= (numPages || 1)}
            onClick={onLastPage}
          >
            <ChevronsRight size={16} />
          </Button>
        </Tooltip>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1 border-r border-[var(--border)] pr-2 shrink-0">
        <Tooltip content="Zoom Out" side="bottom">
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-[var(--foreground)]/[0.08]"
            disabled={zoom <= 0.5}
            onClick={handleZoomOut}
          >
            <ZoomOut size={16} />
          </Button>
        </Tooltip>
        <Tooltip content="Reset Zoom" side="bottom">
          <button
            className="text-code font-medium min-w-[3.125rem] text-center hover:bg-[var(--foreground)]/[0.08] rounded py-1 px-1.5 transition-colors"
            onClick={handleZoomReset}
          >
            {Math.round(zoom * 100)}%
          </button>
        </Tooltip>
        <Tooltip content="Zoom In" side="bottom">
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-[var(--foreground)]/[0.08]"
            disabled={zoom >= 3}
            onClick={handleZoomIn}
          >
            <ZoomIn size={16} />
          </Button>
        </Tooltip>
      </div>

      {/* Rotation */}
      <div className="flex items-center gap-1 border-r border-[var(--border)] pr-2 shrink-0">
        <Tooltip content="Rotate Page" side="bottom">
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-[var(--foreground)]/[0.08]"
            onClick={() => onRotationChange((rotation + 90) % 360)}
          >
            <RotateCw size={16} />
          </Button>
        </Tooltip>
      </div>

      {/* Selection Tools */}
      <div className="flex items-center gap-1 border-r border-[var(--border)] pr-2 shrink-0">
        <Tooltip content={highlightMode ? "Annotation Mode (ON)" : "Annotation Mode (OFF)"} side="bottom">
          <Button
            variant="ghost"
            className={cn(
              "h-8 w-8 p-0",
              highlightMode
                ? "bg-[var(--sky-blue)]/15 text-[var(--sky-blue)] ring-1 ring-[var(--sky-blue)]/30 hover:bg-[var(--sky-blue)]/25"
                : "hover:bg-[var(--foreground)]/[0.08]"
            )}
            onClick={onHighlightModeToggle}
          >
            <Highlighter size={16} />
          </Button>
        </Tooltip>
        <Tooltip content="Open Notes Panel" side="bottom">
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-[var(--foreground)]/[0.08]"
            onClick={onNoteAction}
          >
            <PenLine size={16} />
          </Button>
        </Tooltip>
      </div>

      {/* Misc Actions */}
      <div className="flex items-center gap-1 ml-auto shrink-0">
        {readingStatus && onReadingStatusChange && (
          <div className="w-auto min-w-[3rem]">
            <Tooltip content="Reading Status" side="bottom">
              <Select
                value={readingStatus}
                onChange={(e) => onReadingStatusChange(e.target.value as any)}
                className="h-8 border-none bg-transparent hover:bg-[var(--foreground)]/[0.08] text-caption font-medium px-4 pr-4 transition-all"
              >
                <option value="not_started">Unread</option>
                <option value="in_progress">Reading</option>
                <option value="read">Finished</option>
                <option value="archived">Archived</option>
              </Select>
            </Tooltip>
          </div>
        )}

        {priority && onPriorityChange && (
          <div className="w-auto min-w-[2rem] border-l border-[var(--border)] ml-1 pl-1">
            <Tooltip content="Priority" side="bottom">
              <Select
                value={priority}
                onChange={(e) => onPriorityChange(e.target.value as any)}
                className="h-8 border-none bg-transparent hover:bg-[var(--foreground)]/[0.08] text-caption font-medium px-2 pr-4 transition-all"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </Tooltip>
          </div>
        )}

        <Tooltip content="Bookmark Page" side="bottom">
          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-[var(--foreground)]/[0.08]" onClick={onBookmarkAdd}>
            <Bookmark size={16} />
          </Button>
        </Tooltip>

        <Tooltip content="Download PDF" side="bottom">
          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-[var(--foreground)]/[0.08]" onClick={onDownload}>
            <Download size={16} />
          </Button>
        </Tooltip>

      </div>
    </div>
  );
}
