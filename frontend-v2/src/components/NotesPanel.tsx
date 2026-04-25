import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { DocumentText as FileText, Book1 as BookOpen, Stickynote as StickyNote, Trash as Trash2, Edit as Edit2, Save2 as Save, CloseCircle as X } from 'iconsax-reactjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { annotationsApi, type Annotation } from '@/lib/api/annotations';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';

interface NotesPanelProps {
  paperId: number;
  currentPage: number;
  annotations: Annotation[];
  isLoading: boolean;
}

type NoteScope = 'page' | 'document';

export function NotesPanel({ paperId, currentPage, annotations, isLoading }: NotesPanelProps) {
  const [scope, setScope] = useState<NoteScope>('page');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editScope, setEditScope] = useState<NoteScope>('page');
  const [isCreating, setIsCreating] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newScope, setNewScope] = useState<NoteScope>('page');
  const queryClient = useQueryClient();
  const { confirm, dialogProps } = useConfirmDialog();

  const notes = annotations.filter((a) => a.type === 'note');
  const pageNotes = notes.filter((n) => {
    if (n.note_scope === 'page') {
      const coord = n.coordinate_data as { page?: number } | undefined;
      return coord?.page === currentPage;
    }
    return false;
  });
  const documentNotes = notes.filter((n) => n.note_scope === 'document');
  const displayed = scope === 'page' ? pageNotes : documentNotes;

  const createMutation = useMutation({
    mutationFn: (data: { content: string; noteScope: NoteScope }) =>
      annotationsApi.create({
        paper_id: paperId,
        content: data.content,
        type: 'note',
        note_scope: data.noteScope,
        coordinate_data: data.noteScope === 'page' ? { page: currentPage } : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', paperId] });
      setIsCreating(false);
      setNewContent('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => annotationsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['annotations', paperId] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, content, noteScope }: { id: number; content: string; noteScope: NoteScope }) =>
      annotationsApi.update(id, { content, note_scope: noteScope }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', paperId] });
      setEditingId(null);
      setEditContent('');
    },
  });

  const startEdit = (note: Annotation) => {
    setEditingId(note.id);
    setEditContent(note.content || '');
    setEditScope(note.note_scope === 'document' ? 'document' : 'page');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = () => {
    if (editingId && editContent.trim()) {
      updateMutation.mutate({ id: editingId, content: editContent, noteScope: editScope });
    }
  };

  const handleDelete = (id: number) => {
    confirm({
      title: 'Delete Note',
      description: 'Are you sure you want to delete this note? This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    }).then((ok) => { if (ok) deleteMutation.mutate(id); });
  };

  const renderContent = (content: string) => {
    if (/^<[a-z][\s\S]*>/i.test(content.trim())) {
      return (
        <div
          className="prose prose-sm max-w-none text-code text-[var(--foreground)] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="text-code text-[var(--foreground)] mb-2 leading-relaxed">{children}</p>,
          h1: ({ children }) => <h1 className="text-body font-bold text-[var(--foreground)] mt-3 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-code font-bold text-[var(--foreground)] mt-2 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-code font-semibold text-[var(--foreground)] mt-2 mb-1">{children}</h3>,
          ul: ({ children }) => <ul className="text-code text-[var(--foreground)] mb-2 ml-4 list-disc">{children}</ul>,
          ol: ({ children }) => <ol className="text-code text-[var(--foreground)] mb-2 ml-4 list-decimal">{children}</ol>,
          li: ({ children }) => <li className="text-code text-[var(--foreground)] mb-0.5">{children}</li>,
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            return isBlock
              ? <code className="block text-caption bg-[var(--muted)] text-[var(--foreground)] p-2 rounded-lg overflow-x-auto mb-2">{children}</code>
              : <code className="text-caption bg-[var(--muted)] px-1.5 py-0.5 rounded">{children}</code>;
          },
          a: ({ href, children }) => <a href={href} className="text-[var(--sky-blue)] hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
          strong: ({ children }) => <strong className="font-semibold text-[var(--foreground)]">{children}</strong>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-[var(--border)] pl-3 text-[var(--muted-foreground)] mb-2 text-code">{children}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scope toggle & New Note button */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-1 p-1 bg-[var(--muted)]/40 rounded-lg w-fit">
          <button
            onClick={() => setScope('page')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-medium transition-colors',
              scope === 'page'
                ? 'bg-[var(--white)] text-[var(--foreground)] shadow-subtle'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
          >
            <FileText size={12} />
            Page {currentPage}
          </button>
          <button
            onClick={() => setScope('document')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-medium transition-colors',
              scope === 'document'
                ? 'bg-[var(--white)] text-[var(--foreground)] shadow-subtle'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
          >
            <BookOpen size={12} />
            Document
          </button>
        </div>

        {!isCreating && (
          <Button 
            size="sm" 
            className="h-8 rounded-lg"
            onClick={() => {
              setIsCreating(true);
              setNewScope(scope);
            }}
          >
            New Note
          </Button>
        )}
      </div>

      {/* New Note Form */}
      {isCreating && (
        <div className="mb-6 rounded-xl border border-[var(--foreground)]/10 bg-[var(--muted)]/10 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-caption font-semibold text-[var(--foreground)]">Create New Note</h3>
            <div className="flex items-center gap-2">
              <span className="text-caption text-[var(--muted-foreground)]">Scope:</span>
              <div className="flex items-center gap-1 p-0.5 bg-[var(--muted)]/40 rounded-lg">
                {(['page', 'document'] as NoteScope[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setNewScope(s)}
                    disabled={createMutation.isPending}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded text-caption font-medium transition-colors capitalize',
                      newScope === s
                        ? 'bg-[var(--foreground)] text-[var(--background)]'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                    )}
                  >
                    {s === 'page' ? <FileText size={11} /> : <BookOpen size={11} />}
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={4}
            className="w-full text-code bg-[var(--card)] focus-visible:ring-1"
            placeholder={newScope === 'page' ? `Write note for page ${currentPage}...` : 'Write document-wide note...'}
            autoFocus
            disabled={createMutation.isPending}
          />

          <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-[var(--border)]">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setIsCreating(false); setNewContent(''); }} 
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate({ content: newContent, noteScope: newScope })}
              disabled={!newContent.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create Note'}
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-[var(--muted)]/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : displayed.length > 0 ? (
        <div className="space-y-3">
          {displayed.map((note) => {
            const notePage = (note.coordinate_data as { page?: number } | undefined)?.page;
            const isEditing = editingId === note.id;

            return (
              <div
                key={note.id}
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  isEditing
                    ? 'border-[var(--foreground)]/20 bg-[var(--muted)]/20'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted-foreground)]/30',
                )}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    {/* Edit scope toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-caption text-[var(--muted-foreground)]">Scope:</span>
                      <div className="flex items-center gap-1 p-0.5 bg-[var(--muted)]/40 rounded-lg">
                        {(['page', 'document'] as NoteScope[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => setEditScope(s)}
                            disabled={updateMutation.isPending}
                            className={cn(
                              'flex items-center gap-1 px-2 py-1 rounded text-caption font-medium transition-colors capitalize',
                              editScope === s
                                ? 'bg-[var(--foreground)] text-[var(--background)]'
                                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                            )}
                          >
                            {s === 'page' ? <FileText size={11} /> : <BookOpen size={11} />}
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={6}
                      className="w-full text-code bg-[var(--white)]"
                      placeholder="Write your note..."
                      autoFocus
                      disabled={updateMutation.isPending}
                    />

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                      <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={updateMutation.isPending}>
                        <X size={13} className="mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveEdit}
                        disabled={!editContent.trim() || updateMutation.isPending}
                      >
                        <Save size={13} className="mr-1" />
                        {updateMutation.isPending ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-3">{renderContent(note.content)}</div>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                      <div className="flex items-center gap-2 text-micro text-[var(--muted-foreground)] opacity-60">
                        {note.note_scope === 'page' && notePage && (
                          <span>Page {notePage}</span>
                        )}
                        {note.note_scope === 'document' && <span>Document</span>}
                        <span>{format(new Date(note.created_at), 'MMM d, yyyy')}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => startEdit(note)}
                          disabled={deleteMutation.isPending || editingId !== null}
                        >
                          <Edit2 size={12} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                          onClick={() => handleDelete(note.id)}
                          disabled={deleteMutation.isPending || editingId !== null}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-[var(--muted)]/10 rounded-2xl border border-dashed border-[var(--border)]">
          <StickyNote size={32} className="mb-4 text-[var(--muted-foreground)] opacity-30" />
          <p className="text-code text-[var(--muted-foreground)]">
            {scope === 'page' ? `No notes for page ${currentPage}` : 'No document notes yet'}
          </p>
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
