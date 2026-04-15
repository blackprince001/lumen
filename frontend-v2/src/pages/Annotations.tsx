import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { annotationsApi, type Annotation } from '@/lib/api/annotations';
import { getAuthHeaders } from '@/lib/api/client';
import { DocumentText as FileText, Message as MessageSquare, Magicpen as Highlighter, Trash as Trash2, Edit as Edit2, CloseCircle as X, TickCircle as Check } from 'iconsax-reactjs';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SearchInput } from '@/components/ui/SearchInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog';
import { Textarea } from '@/components/ui/Textarea';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toastSuccess, toastError } from '@/lib/utils/toast';

type FilterType = 'all' | 'highlight' | 'note';

export default function Annotations() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, dialogProps } = useConfirmDialog();

  // Fetch all papers first
  const { data: papersData, isLoading: papersLoading } = useQuery({
    queryKey: ['all-papers'],
    queryFn: async () => {
      const allPapers: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore)
      {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/papers?page=${page}&page_size=100`, {
          headers: { ...getAuthHeaders() },
        });
        const data = await response.json();
        allPapers.push(...data.papers);
        hasMore = data.papers.length === 100 && allPapers.length < data.total;
        page++;
      }
      return allPapers;
    },
  });

  // Fetch annotations for all papers in parallel
  const { data: allAnnotations = [], isLoading: annotationsLoading } = useQuery({
    queryKey: ['all-annotations', papersData?.map(p => p.id)],
    queryFn: async () => {
      if (!papersData || papersData.length === 0) return [];

      const annotationPromises = papersData.map(async (paper: any) => {
        try
        {
          const annotations = await annotationsApi.list(paper.id);
          return annotations.map(ann => ({ ...ann, paperTitle: paper.title, paperId: paper.id }));
        } catch (error)
        {
          console.error(`Failed to fetch annotations for paper ${paper.id}:`, error);
          return [];
        }
      });

      const results = await Promise.all(annotationPromises);
      return results.flat();
    },
    enabled: !!papersData && papersData.length > 0,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      annotationsApi.update(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations'] });
      setEditingId(null);
      toastSuccess('Annotation updated');
    },
    onError: () => toastError('Failed to update annotation'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => annotationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations'] });
      toastSuccess('Annotation deleted');
    },
    onError: () => toastError('Failed to delete annotation'),
  });

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Delete Annotation',
      description: 'Are you sure you want to delete this annotation?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deleteMutation.mutate(id);
  };

  const startEdit = (annotation: Annotation) => {
    setEditingId(annotation.id);
    setEditContent(annotation.content || '');
  };

  const saveEdit = () => {
    if (editingId && editContent.trim())
    {
      updateMutation.mutate({ id: editingId, content: editContent });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleAnnotationClick = (annotation: Annotation & { paperId?: number }) => {
    if (annotation.paperId)
    {
      const page = annotation.coordinate_data?.page;
      navigate(`/papers/${annotation.paperId}${page ? `?page=${page}` : ''}`);
    }
  };

  // Filter annotations
  const filteredAnnotations = allAnnotations.filter(ann => {
    if (filter === 'highlight' && ann.type !== 'annotation') return false;
    if (filter === 'note' && ann.type !== 'note') return false;
    if (searchQuery && !ann.content?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !ann.highlighted_text?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getIcon = (type: string) => {
    return type === 'note' ? MessageSquare : Highlighter;
  };

  const isLoading = papersLoading || annotationsLoading;

  if (isLoading)
  {
    return (
      <div className="max-w-content mx-auto px-6 py-8">
        <Skeleton className="w-64 h-8 mb-2" />
        <Skeleton className="w-96 h-5 mb-8" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="w-full h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-content mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1>Annotations</h1>
            <p className="text-btn text-[var(--muted-foreground)] mt-1">
              All your highlights and notes across papers
            </p>
          </div>
        </div>

        {/* Filters and search */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'h-8 px-3 text-code font-medium rounded-lg transition-colors',
                filter === 'all'
                  ? 'bg-[var(--primary)] [color:var(--primary-foreground)]'
                  : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]'
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter('highlight')}
              className={cn(
                'h-8 px-3 text-code font-medium rounded-lg transition-colors flex items-center gap-1.5',
                filter === 'highlight'
                  ? 'bg-[var(--primary)] [color:var(--primary-foreground)]'
                  : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]'
              )}
            >
              <Highlighter size={14} />
              <span>Highlights</span>
            </button>
            <button
              onClick={() => setFilter('note')}
              className={cn(
                'h-8 px-3 text-code font-medium rounded-lg transition-colors flex items-center gap-1.5',
                filter === 'note'
                  ? 'bg-[var(--primary)] [color:var(--primary-foreground)]'
                  : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]'
              )}
            >
              <MessageSquare size={14} />
              <span>Notes</span>
            </button>
          </div>
          <div className="flex-1 max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search annotations..."
            />
          </div>
        </div>

        {/* Annotations list */}
        {filteredAnnotations.length === 0 ? (
          <div className="text-center py-12 text-[var(--muted-foreground)]">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-body">No annotations found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnnotations.map((annotation) => {
              const Icon = getIcon(annotation.type ?? 'annotation');
              return (
                <Card key={annotation.id} variant="feature">
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center shrink-0 mt-0.5">
                        <Icon size={16} className="text-[var(--muted-foreground)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <button
                            onClick={() => handleAnnotationClick(annotation)}
                            className="text-code font-medium text-[var(--sky-blue)] hover:underline"
                          >
                            {annotation.paperTitle || 'Unknown Paper'}
                          </button>
                          <div className="flex items-center gap-1">
                            {editingId !== annotation.id && (
                              <>
                                <Button
                                  variant="ghost"
                                  className="!h-7 !w-7 !p-0"
                                  onClick={() => startEdit(annotation)}
                                >
                                  <Edit2 size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="!h-7 !w-7 !p-0 text-[var(--destructive)]"
                                  onClick={() => handleDelete(annotation.id)}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {annotation.highlighted_text && (
                          <div className="mb-2 p-2 bg-[var(--muted)]  rounded">
                            <p className="text-code text-[var(--foreground)]">
                              {annotation.highlighted_text}
                            </p>
                          </div>
                        )}

                        {editingId === annotation.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={3}
                              className="text-code"
                            />
                            <div className="flex items-center gap-2">
                              <Button variant="primary" className="!h-7 !px-3 text-caption" onClick={saveEdit}>
                                <Check size={12} className="mr-1" />
                                Save
                              </Button>
                              <Button variant="ghost" className="!h-7 !px-3 text-caption" onClick={cancelEdit}>
                                <X size={12} className="mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : annotation.content ? (
                          <p className="text-code text-[var(--muted-foreground)] whitespace-pre-wrap">
                            {annotation.content}
                          </p>
                        ) : null}

                        <div className="flex items-center gap-3 mt-2 text-caption text-[var(--muted-foreground)]">
                          {(annotation.coordinate_data?.page as number | undefined) && (
                            <span>Page {annotation.coordinate_data!.page as number}</span>
                          )}
                          <span>{format(new Date(annotation.created_at), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />
    </>
  );
}
