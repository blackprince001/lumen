import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTabs } from '@/contexts/TabContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DocumentText as FileText, MagicStar as Sparkles, Magicpen as Highlighter, Link, Message as MessageSquare, Stickynote as StickyNote, SidebarRight as PanelRightClose, Bookmark } from 'iconsax-reactjs';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { PaperDetails } from '@/components/PaperDetails';
import { AISummary } from '@/components/AISummary';
import { KeyFindings } from '@/components/KeyFindings';
import { ReadingGuide } from '@/components/ReadingGuide';
import { AutoHighlights } from '@/components/AutoHighlights';
import { PaperAnnotationsPanel } from '@/components/PaperAnnotationsPanel';
import { NotesPanel } from '@/components/NotesPanel';
import { RelatedPapers } from '@/components/RelatedPapers';
import { ChatTab } from '@/components/ChatTab';
import { BookmarksTab } from '@/components/BookmarksTab';
import { papersApi } from '@/lib/api/papers';
import { annotationsApi } from '@/lib/api/annotations';

interface ChatPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function ChatPanel({ isOpen, onToggle, activeTab, setActiveTab }: ChatPanelProps) {
  const { id } = useParams<{ id: string }>();
  const paperId = id ? parseInt(id) : undefined;
  // activeTab is now managed by Layout
  const [filterByPage, setFilterByPage] = useState(false);
  const queryClient = useQueryClient();
  const { tabs, activeTabId } = useTabs();
  const currentPage = tabs.find((t) => t.id === activeTabId)?.currentPage ?? 1;

  const { data: paper } = useQuery({
    queryKey: ['paper', paperId],
    queryFn: () => papersApi.get(paperId!),
    enabled: !!paperId,
  });

  const { data: annotations = [], isLoading: annotationsLoading } = useQuery({
    queryKey: ['annotations', paperId],
    queryFn: () => annotationsApi.list(paperId!),
    enabled: !!paperId,
  });

  const deleteAnnotationMutation = useMutation({
    mutationFn: (annotationId: number) => annotationsApi.delete(annotationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['annotations', paperId] }),
  });

  // Split into highlights/annotations vs freeform notes
  const annotationItems = annotations.filter((a) => a.type !== 'note');
  const noteItems = annotations.filter((a) => a.type === 'note');

  if (!isOpen) return null;

  return (
    <div className="w-full h-full rounded-[var(--panel-radius)] border border-[var(--panel-border)] bg-[var(--panel-surface)] shadow-[var(--shadow-panel)] backdrop-blur-sm flex flex-col overflow-hidden">
      {!paperId || !paper ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--muted-foreground)] opacity-50">
          <FileText size={32} className="mb-3" />
          <p className="text-code">Open a paper to see details</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          {/* Tab header */}
          <div className="flex items-center justify-between shrink-0 border-b border-[var(--panel-border)] px-3 py-2.5 bg-[var(--panel-surface)]">
            <TabsList className="gap-0 border-none bg-transparent px-0 flex-1 overflow-x-auto scrollbar-none items-center">
              <TabsTrigger value="details" className="h-12 gap-1.5 border-b-2 rounded-none px-3 shrink-0">
                <FileText size={13} />
                <span className="hidden xl:inline text-caption">Details</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="h-12 gap-1.5 border-b-2 rounded-none px-3 shrink-0">
                <Sparkles size={13} />
                <span className="hidden xl:inline text-caption">Insights</span>
              </TabsTrigger>
              <TabsTrigger value="related" className="h-12 gap-1.5 border-b-2 rounded-none px-3 shrink-0">
                <Link size={13} />
                <span className="hidden xl:inline text-caption">Related</span>
              </TabsTrigger>

              <div className="h-6 w-px bg-[var(--border)] mx-1 shrink-0" />
              <TabsTrigger value="chat" className="h-12 gap-1.5 border-b-2 rounded-none px-3 shrink-0">
                <MessageSquare size={13} />
                <span className="hidden xl:inline text-caption">Chat</span>
              </TabsTrigger>
              <TabsTrigger value="notes" className="h-12 gap-1.5 border-b-2 rounded-none px-3 shrink-0">
                <StickyNote size={13} />
                <span className="hidden xl:inline text-caption">Notes</span>
                {noteItems.length > 0 && (
                  <span className="text-micro bg-[var(--muted)] px-1.5 py-0.5 rounded-full tabular-nums">
                    {noteItems.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="annotations" className="h-12 gap-1.5 border-b-2 rounded-none px-3 shrink-0">
                <Highlighter size={13} />
                <span className="hidden xl:inline text-caption">Annotate</span>
                {annotationItems.length > 0 && (
                  <span className="text-micro bg-[var(--muted)] px-1.5 py-0.5 rounded-full tabular-nums">
                    {annotationItems.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="bookmarks" className="h-12 gap-1.5 border-b-2 rounded-none px-3 shrink-0">
                <Bookmark size={13} />
                <span className="hidden xl:inline text-caption">Marks</span>
              </TabsTrigger>
            </TabsList>

            <button
              onClick={onToggle}
              className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors ml-1 shrink-0"
              aria-label="Close panel"
            >
              <PanelRightClose size={16} />
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden relative bg-[var(--panel-surface)]">
            <TabsContent value="details" className="h-full overflow-y-auto scrollbar-none">
              <PaperDetails paper={paper} onDelete={() => { }} />
            </TabsContent>

            <TabsContent value="ai" className="h-full overflow-y-auto scrollbar-none p-6 text-[var(--foreground)]">
              <div className="space-y-8">
                <AutoHighlights paperId={paper.id} />

                <section>
                  <h3 className="text-body font-bold mb-4">Executive Summary</h3>
                  <AISummary paperId={paper.id} />
                </section>

                <div className="border-t border-dashed border-[var(--border)]" />

                <section>
                  <h3 className="text-body font-bold mb-4">Core Insights</h3>
                  <KeyFindings paperId={paper.id} />
                </section>

                <div className="border-t border-dashed border-[var(--border)]" />

                <section>
                  <h3 className="text-body font-bold mb-4">Reading Guide</h3>
                  <ReadingGuide paperId={paper.id} />
                </section>
              </div>
            </TabsContent>

            {/* Notes tab — freeform notes (type === 'note'), page/document scoped */}
            <TabsContent value="notes" className="h-full overflow-y-auto scrollbar-none p-6">
              <NotesPanel
                paperId={paper.id}
                currentPage={currentPage}
                annotations={annotations}
                isLoading={annotationsLoading}
              />
            </TabsContent>

            {/* Annotations tab — highlights only (type !== 'note') */}
            <TabsContent value="annotations" className="h-full overflow-y-auto scrollbar-none p-6">
              <PaperAnnotationsPanel
                annotations={annotationItems}
                isLoading={annotationsLoading}
                currentPage={currentPage}
                filterByPage={filterByPage}
                onFilterByPageChange={setFilterByPage}
                onAnnotationClick={() => { }}
                onEditAnnotation={() => { }}
                onDeleteAnnotation={(annotationId) => deleteAnnotationMutation.mutate(annotationId)}
              />
            </TabsContent>

            <TabsContent value="related" className="h-full overflow-y-auto scrollbar-none p-6">
              <RelatedPapers paperId={paper.id} />
            </TabsContent>

            <TabsContent value="chat" className="h-full flex flex-col overflow-hidden">
              <ChatTab paperId={paper.id} />
            </TabsContent>

            <TabsContent value="bookmarks" className="h-full overflow-y-auto scrollbar-none">
              <BookmarksTab paperId={paper.id} onJumpToPage={(page) => {
                // TODO: Implement jump to page functionality
                console.log('Jump to page:', page);
              }} />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}
