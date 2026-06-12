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
  const [aiTab, setAiTab] = useState('summary');
  const queryClient = useQueryClient();
  const { tabs, activeTabId, updateTab } = useTabs();
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
    <div className="w-full h-full rounded-(--panel-radius) border border-(--panel-border) bg-(--panel-surface) shadow-(--shadow-panel) backdrop-blur-sm flex flex-col overflow-hidden">
      {!paperId || !paper ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-(--muted-foreground) opacity-50">
          <FileText size={32} className="mb-3" />
          <p className="text-code">Open a paper to see details</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          {/* Icon-only pill bar */}
          <div className="flex items-center justify-between shrink-0 border-b border-(--panel-border) bg-(--panel-surface)">
            <TabsList className="flex items-center gap-1 px-3 py-2 border-none bg-transparent">
              <TabsTrigger value="details" title="Details" className="inline-flex items-center justify-center w-10 h-10 rounded-full text-caption transition-all duration-150 border data-[state=active]:bg-(--foreground) data-[state=active]:text-(--card) data-[state=active]:border-(--foreground) data-[state=inactive]:bg-(--card) data-[state=inactive]:text-(--muted-foreground) data-[state=inactive]:border-(--border) data-[state=inactive]:hover:text-(--foreground) data-[state=inactive]:hover:border-(--foreground)/30">
                <FileText size={18} />
              </TabsTrigger>
              <TabsTrigger value="ai" title="Insights" className="inline-flex items-center justify-center w-10 h-10 rounded-full text-caption transition-all duration-150 border data-[state=active]:bg-(--foreground) data-[state=active]:text-(--card) data-[state=active]:border-(--foreground) data-[state=inactive]:bg-(--card) data-[state=inactive]:text-(--muted-foreground) data-[state=inactive]:border-(--border) data-[state=inactive]:hover:text-(--foreground) data-[state=inactive]:hover:border-(--foreground)/30">
                <Sparkles size={18} />
              </TabsTrigger>
              <TabsTrigger value="related" title="Related" className="inline-flex items-center justify-center w-10 h-10 rounded-full text-caption transition-all duration-150 border data-[state=active]:bg-(--foreground) data-[state=active]:text-(--card) data-[state=active]:border-(--foreground) data-[state=inactive]:bg-(--card) data-[state=inactive]:text-(--muted-foreground) data-[state=inactive]:border-(--border) data-[state=inactive]:hover:text-(--foreground) data-[state=inactive]:hover:border-(--foreground)/30">
                <Link size={18} />
              </TabsTrigger>
              <TabsTrigger value="chat" title="Chat" className="inline-flex items-center justify-center w-10 h-10 rounded-full text-caption transition-all duration-150 border data-[state=active]:bg-(--foreground) data-[state=active]:text-(--card) data-[state=active]:border-(--foreground) data-[state=inactive]:bg-(--card) data-[state=inactive]:text-(--muted-foreground) data-[state=inactive]:border-(--border) data-[state=inactive]:hover:text-(--foreground) data-[state=inactive]:hover:border-(--foreground)/30">
                <MessageSquare size={18} />
              </TabsTrigger>
              <TabsTrigger value="notes" title="Notes" className="inline-flex items-center justify-center w-10 h-10 rounded-full text-caption transition-all duration-150 border data-[state=active]:bg-(--foreground) data-[state=active]:text-(--card) data-[state=active]:border-(--foreground) data-[state=inactive]:bg-(--card) data-[state=inactive]:text-(--muted-foreground) data-[state=inactive]:border-(--border) data-[state=inactive]:hover:text-(--foreground) data-[state=inactive]:hover:border-(--foreground)/30">
                <StickyNote size={18} />
                {noteItems.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 text-micro bg-(--muted) px-1 py-0.5 rounded-full tabular-nums leading-none">
                    {noteItems.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="annotations" title="Annotations" className="relative inline-flex items-center justify-center w-10 h-10 rounded-full text-caption transition-all duration-150 border data-[state=active]:bg-(--foreground) data-[state=active]:text-(--card) data-[state=active]:border-(--foreground) data-[state=inactive]:bg-(--card) data-[state=inactive]:text-(--muted-foreground) data-[state=inactive]:border-(--border) data-[state=inactive]:hover:text-(--foreground) data-[state=inactive]:hover:border-(--foreground)/30">
                <Highlighter size={18} />
                {annotationItems.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 text-micro bg-(--muted) px-1 py-0.5 rounded-full tabular-nums leading-none">
                    {annotationItems.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="bookmarks" title="Bookmarks" className="inline-flex items-center justify-center w-10 h-10 rounded-full text-caption transition-all duration-150 border data-[state=active]:bg-(--foreground) data-[state=active]:text-(--card) data-[state=active]:border-(--foreground) data-[state=inactive]:bg-(--card) data-[state=inactive]:text-(--muted-foreground) data-[state=inactive]:border-(--border) data-[state=inactive]:hover:text-(--foreground) data-[state=inactive]:hover:border-(--foreground)/30">
                <Bookmark size={18} />
              </TabsTrigger>
            </TabsList>

            <button
              onClick={onToggle}
              className="p-1.5 mr-2 text-(--muted-foreground) hover:text-(--foreground) hover:bg-(--muted) rounded-lg transition-colors shrink-0"
              aria-label="Close panel"
            >
              <PanelRightClose size={16} />
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden relative bg-(--panel-surface)">
            <TabsContent value="details" className="h-full overflow-y-auto scrollbar-none">
              <PaperDetails paper={paper} onDelete={() => { }} />
            </TabsContent>

            <TabsContent value="ai" className="h-full overflow-hidden flex flex-col">
              <Tabs value={aiTab} onValueChange={setAiTab} className="flex flex-col h-full">
                <div className="shrink-0 border-b border-(--border) px-3 py-1.5 bg-(--panel-surface)">
                  <TabsList className="gap-0.5 border-none bg-transparent">
                    <TabsTrigger value="summary" className="px-2.5 py-1 text-caption rounded-full border data-[state=active]:bg-(--foreground) data-[state=active]:text-(--card) data-[state=active]:border-(--foreground) data-[state=inactive]:bg-(--card) data-[state=inactive]:text-(--muted-foreground) data-[state=inactive]:border-(--border)">
                      Summary
                    </TabsTrigger>
                    <TabsTrigger value="insights" className="px-2.5 py-1 text-caption rounded-full border data-[state=active]:bg-(--foreground) data-[state=active]:text-(--card) data-[state=active]:border-(--foreground) data-[state=inactive]:bg-(--card) data-[state=inactive]:text-(--muted-foreground) data-[state=inactive]:border-(--border)">
                      Insights
                    </TabsTrigger>
                    <TabsTrigger value="guide" className="px-2.5 py-1 text-caption rounded-full border data-[state=active]:bg-(--foreground) data-[state=active]:text-(--card) data-[state=active]:border-(--foreground) data-[state=inactive]:bg-(--card) data-[state=inactive]:text-(--muted-foreground) data-[state=inactive]:border-(--border)">
                      Guide
                    </TabsTrigger>
                    <TabsTrigger value="highlights" className="px-2.5 py-1 text-caption rounded-full border data-[state=active]:bg-(--foreground) data-[state=active]:text-(--card) data-[state=active]:border-(--foreground) data-[state=inactive]:bg-(--card) data-[state=inactive]:text-(--muted-foreground) data-[state=inactive]:border-(--border)">
                      Highlights
                    </TabsTrigger>
                  </TabsList>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-none p-6 text-(--foreground)">
                  <TabsContent value="summary">
                    <section>
                      <h3 className="text-body font-bold mb-4">Executive Summary</h3>
                      <AISummary paperId={paper.id} />
                    </section>
                  </TabsContent>
                  <TabsContent value="insights">
                    <section>
                      <h3 className="text-body font-bold mb-4">Core Insights</h3>
                      <KeyFindings paperId={paper.id} />
                    </section>
                  </TabsContent>
                  <TabsContent value="guide">
                    <section>
                      <h3 className="text-body font-bold mb-4">Reading Guide</h3>
                      <ReadingGuide paperId={paper.id} />
                    </section>
                  </TabsContent>
                  <TabsContent value="highlights">
                    <AutoHighlights paperId={paper.id} />
                  </TabsContent>
                </div>
              </Tabs>
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
                onAnnotationClick={(ann) => {
                  const page = (ann.coordinate_data as { page?: number })?.page;
                  if (page) {
                    const tab = tabs.find((t) => t.id === activeTabId);
                    if (tab) updateTab(tab.id, { currentPage: page });
                  }
                }}
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
