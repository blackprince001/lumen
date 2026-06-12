import { SearchZoomIn as ZoomIn, SearchZoomOut as ZoomOut, MenuBoard as List, ArrowLeft2 as ChevronLeft, ArrowRight2 as ChevronRight, ArrowLeft3 as ChevronsLeft, ArrowRight3 as ChevronsRight, DocumentDownload as Download, Bookmark, ArrowRotateRight as RotateCw, Magicpen as Highlighter, PenTool as PenLine, More } from 'iconsax-reactjs';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/Popover';
import { cn } from '@/lib/utils';
import { useOverflow } from '@/hooks/use-overflow';

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

export function PDFToolbar(props: PDFToolbarProps) {
  const { containerRef, hiddenSections } = useOverflow();

  const handleZoomIn = () => props.onZoomChange(Math.min(props.zoom + 0.25, 3));
  const handleZoomOut = () => props.onZoomChange(Math.max(props.zoom - 0.25, 0.5));
  const handleZoomReset = () => props.onZoomChange(1);

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 1 && val <= (props.numPages || 1)) {
      props.onPageChange(val);
    }
  };

  const isHidden = (id: string) => hiddenSections.includes(id);

  const SectionTOC = () => (
    <div className="flex items-center gap-1 shrink-0" data-section="toc">
      <Tooltip content={props.showTOC ? "Hide Table of Contents" : "Show Table of Contents"} side="bottom">
        <Button
          variant="ghost"
          className={cn(
            "h-8 w-8 p-0 hover:bg-(--foreground)/8",
            props.showTOC && "bg-(--foreground)/8 text-(--foreground)"
          )}
          onClick={props.onTOCToggle}
        >
          <List size={16} />
        </Button>
      </Tooltip>
    </div>
  );

  const SectionNav = () => (
    <div className="flex items-center gap-1 shrink-0" data-section="nav">
      <Tooltip content="First Page" side="bottom">
        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-(--foreground)/8" disabled={props.currentPage <= 1} onClick={props.onFirstPage}>
          <ChevronsLeft size={16} />
        </Button>
      </Tooltip>
      <Tooltip content="Previous Page" side="bottom">
        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-(--foreground)/8" disabled={props.currentPage <= 1} onClick={props.onPreviousPage}>
          <ChevronLeft size={16} />
        </Button>
      </Tooltip>
      <div className="flex items-center gap-1 px-1">
        <input
          type="number"
          value={props.currentPage}
          onChange={handlePageInput}
          className="w-12 h-7 bg-(--muted) border border-(--border) rounded text-code text-center focus:outline-none focus:ring-1 focus:ring-(--foreground)"
          min={1}
          max={props.numPages || 1}
        />
        <span className="text-caption text-(--muted-foreground) whitespace-nowrap">
          / {props.numPages || '?'}
        </span>
      </div>
      <Tooltip content="Next Page" side="bottom">
        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-(--foreground)/8" disabled={props.currentPage >= (props.numPages || 1)} onClick={props.onNextPage}>
          <ChevronRight size={16} />
        </Button>
      </Tooltip>
      <Tooltip content="Last Page" side="bottom">
        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-(--foreground)/8" disabled={props.currentPage >= (props.numPages || 1)} onClick={props.onLastPage}>
          <ChevronsRight size={16} />
        </Button>
      </Tooltip>
    </div>
  );

  const SectionZoom = () => (
    <div className="flex items-center gap-1 shrink-0" data-section="zoom">
      <Tooltip content="Zoom Out" side="bottom">
        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-(--foreground)/8" disabled={props.zoom <= 0.5} onClick={handleZoomOut}>
          <ZoomOut size={16} />
        </Button>
      </Tooltip>
      <Tooltip content="Reset Zoom" side="bottom">
        <button className="text-code font-medium min-w-12.5 text-center hover:bg-(--foreground)/8 rounded py-1 px-1.5 transition-colors" onClick={handleZoomReset}>
          {Math.round(props.zoom * 100)}%
        </button>
      </Tooltip>
      <Tooltip content="Zoom In" side="bottom">
        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-(--foreground)/8" disabled={props.zoom >= 3} onClick={handleZoomIn}>
          <ZoomIn size={16} />
        </Button>
      </Tooltip>
    </div>
  );

  const SectionRotate = () => (
    <div className="flex items-center gap-1 shrink-0" data-section="rotate">
      <Tooltip content="Rotate Page" side="bottom">
        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-(--foreground)/8" onClick={() => props.onRotationChange((props.rotation + 90) % 360)}>
          <RotateCw size={16} />
        </Button>
      </Tooltip>
    </div>
  );

  const SectionTools = () => (
    <div className="flex items-center gap-1 shrink-0" data-section="tools">
      <Tooltip content={props.highlightMode ? "Annotation Mode (ON)" : "Annotation Mode (OFF)"} side="bottom">
        <Button
          variant="ghost"
          className={cn(
            "h-8 w-8 p-0",
            props.highlightMode
              ? "bg-(--sky-blue)/15 text-(--sky-blue) ring-1 ring-(--sky-blue)/30 hover:bg-(--sky-blue)/25"
              : "hover:bg-(--foreground)/8"
          )}
          onClick={props.onHighlightModeToggle}
        >
          <Highlighter size={16} />
        </Button>
      </Tooltip>
      <Tooltip content="Open Notes Panel" side="bottom">
        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-(--foreground)/8" onClick={props.onNoteAction}>
          <PenLine size={16} />
        </Button>
      </Tooltip>
    </div>
  );

  const SectionStatus = () => (
    <div className="flex items-center gap-1 shrink-0" data-section="status">
      {props.readingStatus && props.onReadingStatusChange && (
        <Tooltip content="Reading Status" side="bottom">
          <Select
            value={props.readingStatus}
            onChange={(e) => props.onReadingStatusChange!(e.target.value as any)}
            className="h-8 border-none bg-transparent hover:bg-(--foreground)/8 text-caption font-medium px-4 pr-4 transition-all"
          >
            <option value="not_started">Unread</option>
            <option value="in_progress">Reading</option>
            <option value="read">Finished</option>
            <option value="archived">Archived</option>
          </Select>
        </Tooltip>
      )}
    </div>
  );

  const SectionPriority = () => (
    <div className="flex items-center gap-1 shrink-0" data-section="priority">
      {props.priority && props.onPriorityChange && (
        <Tooltip content="Priority" side="bottom">
          <Select
            value={props.priority}
            onChange={(e) => props.onPriorityChange!(e.target.value as any)}
            className="h-8 border-none bg-transparent hover:bg-(--foreground)/8 text-caption font-medium px-2 pr-4 transition-all"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
        </Tooltip>
      )}
    </div>
  );

  const SectionBookmark = () => (
    <div className="flex items-center gap-1 shrink-0" data-section="bookmark">
      <Tooltip content="Bookmark Page" side="bottom">
        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-(--foreground)/8" onClick={props.onBookmarkAdd}>
          <Bookmark size={16} />
        </Button>
      </Tooltip>
    </div>
  );

  const SectionDownload = () => (
    <div className="flex items-center gap-1 shrink-0" data-section="download">
      <Tooltip content="Download PDF" side="bottom">
        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-(--foreground)/8" onClick={props.onDownload}>
          <Download size={16} />
        </Button>
      </Tooltip>
    </div>
  );

  const allSections = [
    { id: 'toc', Comp: SectionTOC },
    { id: 'nav', Comp: SectionNav },
    { id: 'zoom', Comp: SectionZoom },
    { id: 'rotate', Comp: SectionRotate },
    { id: 'tools', Comp: SectionTools },
    { id: 'status', Comp: SectionStatus },
    { id: 'priority', Comp: SectionPriority },
    { id: 'bookmark', Comp: SectionBookmark },
    { id: 'download', Comp: SectionDownload },
  ];

  const visible = allSections.filter(s => !isHidden(s.id));
  const overflowItems = allSections.filter(s => isHidden(s.id));

  return (
    <div ref={containerRef} className="flex items-center gap-2 px-4 py-2 border-b border-(--border) bg-(--white) shrink-0 z-20">
      {/* Visible sections */}
      {visible.map(s => <s.Comp key={s.id} />)}

      {/* Separator before dots when overflow exists */}
      {overflowItems.length > 0 && (
        <div className="w-px h-6 bg-(--border) shrink-0" />
      )}

      {/* Overflow menu */}
      <div data-section="dots" className="shrink-0">
        {overflowItems.length > 0 && (
          <Popover>
            <PopoverTrigger className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-(--foreground)/8 transition-colors">
              <More size={16} />
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="min-w-48 p-2 space-y-1" style={{ zIndex: 100 }}>
              {overflowItems.map(s => (
                <div key={s.id} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-(--muted) transition-colors">
                  <s.Comp />
                </div>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
