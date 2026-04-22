import { useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { papersApi } from '@/lib/api/papers';
import { annotationsApi } from '@/lib/api/annotations';
import { PDFViewer } from '@/components/PDFViewer';
import { useTabs } from '@/contexts/TabContext';
import { useReadingSession } from '@/hooks/use-reading-session';
import { Warning2 as AlertCircle, DocumentText as FileText } from 'iconsax-reactjs';
import { Button } from '@/components/ui/Button';

export default function PaperDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const paperId = id ? parseInt(id) : undefined;
  const { addTab, updateTab, tabs, activeTabId } = useTabs();
  const { 
    setChatPanelOpen,
    setActiveTab
  } = useOutletContext<{ 
    setChatPanelOpen: (open: boolean) => void,
    setActiveTab: (tab: string) => void
  }>();

  const { data: paper, isLoading: paperLoading, error: paperError, refetch: refetchPaper } = useQuery({
    queryKey: ['paper', paperId],
    queryFn: () => papersApi.get(paperId!),
    enabled: !!paperId,
  });

  const { data: annotations, refetch: refetchAnnotations } = useQuery({
    queryKey: ['annotations', paperId],
    queryFn: () => annotationsApi.list(paperId!),
    enabled: !!paperId,
  });

  const paperTab = tabs.find((t) => t.paperId === paperId);
  const currentPage = paperTab?.currentPage ?? 1;
  const isReadingActive = !!(paper?.file_url || paper?.file_path) && paperTab?.id === activeTabId;
  useReadingSession(paperId!, isReadingActive, currentPage);

  // Register this paper in the tab system
  useEffect(() => {
    if (paper && paperId) {
      addTab(paperId, paper.title, `/papers/${paperId}`);
    }
  }, [paper, paperId, addTab]);

  if (!paperId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[var(--white)]">
        <AlertCircle size={48} className="text-[var(--destructive)] opacity-20 mb-4" />
        <h2 className="text-subheading font-bold mb-2">Paper not found</h2>
        <p className="text-body text-[var(--muted-foreground)] mb-6">The paper ID provided is invalid or missing.</p>
        <Button onClick={() => navigate('/')}>Return Home</Button>
      </div>
    );
  }

  if (paperLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[var(--background)]">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--border)] border-t-[var(--sky-blue)] animate-spin" />
        <p className="mt-4 text-code font-medium text-[var(--muted-foreground)]">Fetching paper data...</p>
      </div>
    );
  }

  if (paperError || !paper) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[var(--white)]">
        <FileText size={48} className="text-[var(--destructive)] opacity-20 mb-4" />
        <h2 className="text-subheading font-bold mb-2">Error loading paper</h2>
        <p className="text-body text-[var(--muted-foreground)] mb-6">
          {paperError instanceof Error ? paperError.message : 'We could not load the paper data at this time.'}
        </p>
        <Button onClick={() => refetchPaper()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <PDFViewer
        paper={paper}
        annotations={annotations || []}
        onAnnotationSuccess={() => {
          refetchAnnotations();
          refetchPaper();
        }}
        onCurrentPageChange={(page) => {
          const activeTab = tabs.find((t) => t.id === activeTabId);
          if (activeTab) updateTab(activeTab.id, { currentPage: page });
        }}
        onNoteAction={() => {
          setChatPanelOpen(true);
          setActiveTab('notes');
        }}
      />
    </div>
  );
}
