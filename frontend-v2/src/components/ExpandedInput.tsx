import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { annotationsApi } from '@/lib/api/annotations';
import { papersApi } from '@/lib/api/papers';
import { DocumentText as FileText, Book1 as BookOpen, Stickynote as StickyNote, TickCircle as Check, ArrowDown2 as ChevronDown } from 'iconsax-reactjs';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/Popover';
import { cn } from '@/lib/utils';

interface MentionItem {
  id: number;
  type: 'note' | 'annotation' | 'paper';
  display: string;
  content?: string;
  title?: string;
}

interface SuggestionPrompt {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  text: string;
  prompt: string;
}

export interface PromptGroup {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  prompts: SuggestionPrompt[];
}

export interface ExpandedInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  autoFocus?: boolean;
  size?: 'default' | 'compact';
  submitLabel?: string;
  submitIcon?: ReactNode;
  suggestions?: SuggestionPrompt[];
  onSuggestionClick?: (prompt: string) => void;
  promptsCollapsible?: boolean;
  promptGroups?: PromptGroup[];
  mentionPaperId?: number;
  onMentionSelect?: (mention: MentionItem) => void;
  children?: ReactNode;
  className?: string;
}

export function ExpandedInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ask anything',
  disabled,
  loading,
  autoFocus,
  size = 'default',
  submitLabel,
  submitIcon,
  suggestions,
  onSuggestionClick,
  promptsCollapsible,
  promptGroups,
  mentionPaperId,
  onMentionSelect,
  children,
  className,
}: ExpandedInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);


  // @mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // Fetch mention data when paperId is provided
  const { data: annotations } = useQuery({
    queryKey: ['annotations', mentionPaperId],
    queryFn: () => annotationsApi.list(mentionPaperId!),
    enabled: !!mentionPaperId,
  });

  const { data: papersData } = useQuery({
    queryKey: ['papers'],
    queryFn: () => papersApi.list(1, 100),
    enabled: !!mentionPaperId,
  });

  const buildMentionItems = useCallback((): MentionItem[] => {
    if (!mentionPaperId) return [];
    const items: MentionItem[] = [];

    if (annotations) {
      annotations.filter(a => a.type === 'note').forEach(note => {
        const page = note.coordinate_data?.page;
        items.push({
          id: note.id,
          type: 'note',
          display: `Note ${note.id}${page ? ` (Page ${page})` : ''}`,
          content: note.content,
        });
      });

      annotations.filter(a => a.type === 'annotation').forEach(ann => {
        const page = ann.coordinate_data?.page;
        const preview = ann.highlighted_text || ann.content?.substring(0, 50);
        items.push({
          id: ann.id,
          type: 'annotation',
          display: `Annotation ${ann.id}${page ? ` (Page ${page})` : ''}: ${preview}...`,
          content: ann.content,
        });
      });
    }

    if (papersData?.papers && mentionPaperId) {
      papersData.papers.filter(p => p.id !== mentionPaperId).forEach(paper => {
        items.push({
          id: paper.id,
          type: 'paper',
          display: `Paper: ${paper.title}`,
          title: paper.title,
        });
      });
    }

    return items;
  }, [annotations, papersData, mentionPaperId]);

  const allMentionItems = buildMentionItems();
  const filteredMentionItems = mentionQuery
    ? allMentionItems.filter(item => item.display.toLowerCase().includes(mentionQuery.toLowerCase()))
    : allMentionItems;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (!mentionPaperId) return;

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionQuery(textAfterAt);
        setMentionPosition({ start: lastAtIndex, end: cursorPos });
        setShowMentionDropdown(true);
        setSelectedMentionIndex(0);
        return;
      }
    }

    setShowMentionDropdown(false);
    setMentionQuery('');
  };

  const handleMentionSelect = (item: MentionItem) => {
    const beforeMention = value.substring(0, mentionPosition.start);
    const afterMention = value.substring(mentionPosition.end);
    const mentionText = `@${item.type}{${item.id}}`;
    const newValue = beforeMention + mentionText + afterMention;

    onChange(newValue);
    setShowMentionDropdown(false);
    setMentionQuery('');

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);

    onMentionSelect?.(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showMentionDropdown && filteredMentionItems.length > 0) {
        handleMentionSelect(filteredMentionItems[selectedMentionIndex]);
      } else {
        onSubmit();
      }
      return;
    }

    if (showMentionDropdown && filteredMentionItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => (prev + 1) % filteredMentionItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => (prev - 1 + filteredMentionItems.length) % filteredMentionItems.length);
      } else if (e.key === 'Escape') {
        setShowMentionDropdown(false);
        setMentionQuery('');
      }
    }
  };

  const handlePromptClick = (prompt: string) => {
    onChange(prompt);
    onSuggestionClick?.(prompt);
    textareaRef.current?.focus();
  };

  // Close mention dropdown on outside click
  useEffect(() => {
    if (!showMentionDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowMentionDropdown(false);
      }
    };
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMentionDropdown]);

  // Scroll selected mention into view
  useEffect(() => {
    if (showMentionDropdown && mentionDropdownRef.current) {
      const selected = mentionDropdownRef.current.querySelector(`[data-index="${selectedMentionIndex}"]`);
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedMentionIndex, showMentionDropdown]);

  const getMentionIcon = (type: MentionItem['type']) => {
    switch (type) {
      case 'note': return <StickyNote size={14} />;
      case 'annotation': return <FileText size={14} />;
      case 'paper': return <BookOpen size={14} />;
    }
  };

  const isCompact = size === 'compact';

  const renderSuggestions = () => {
    const hasPrompts = (suggestions?.length || promptGroups?.length) ?? false;
    if (!hasPrompts) return null;

    // Collapsible mode — prompts show in a Popover from the toolbar, not inline
    if (promptsCollapsible) return null;

    return (
      <div className="flex flex-wrap justify-center gap-2">
        {promptGroups && promptGroups.length > 0 ? (
          promptGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.label} className="w-full">
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <GroupIcon size={13} className="text-(--muted-foreground) shrink-0" />
                  <span className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wider">{group.label}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.prompts.map((suggestion) => {
                    const IconComponent = suggestion.icon;
                    return (
                      <button
                        key={suggestion.text}
                        type="button"
                        disabled={disabled}
                        onClick={() => handlePromptClick(suggestion.prompt)}
                        className="group flex items-center gap-2 rounded-full border border-(--border) px-3 py-1.5 text-sm text-(--foreground) transition-colors duration-200 ease-out hover:bg-(--muted)/30 h-auto bg-transparent disabled:opacity-40"
                      >
                        <IconComponent size={14} className="text-(--muted-foreground) transition-colors group-hover:text-(--foreground) shrink-0" />
                        <span>{suggestion.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          (suggestions ?? []).map((suggestion) => {
            const IconComponent = suggestion.icon;
            return (
              <button
                key={suggestion.text}
                type="button"
                disabled={disabled}
                onClick={() => handlePromptClick(suggestion.prompt)}
                className="group flex items-center gap-2 rounded-full border border-(--border) px-3 py-2 text-sm text-(--foreground) transition-colors duration-200 ease-out hover:bg-(--muted)/30 h-auto bg-transparent disabled:opacity-40"
              >
                <IconComponent size={16} className="text-(--muted-foreground) transition-colors group-hover:text-(--foreground) shrink-0" />
                <span>{suggestion.text}</span>
              </button>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col gap-4 w-full', className)}>
      <div className={cn(
        'flex flex-col bg-(--card) border border-(--border) shadow-lg',
        isCompact ? 'rounded-xl' : 'min-h-[7.5rem] rounded-2xl',
      )}>
        {/* Textarea container — no overflow-y so absolute mention dropdown isn't clipped */}
        <div className={cn('relative flex-1', isCompact ? '' : '')}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            className={cn(
              'w-full border-0 outline-none resize-none shadow-none bg-transparent whitespace-pre-wrap wrap-break-word placeholder:text-(--muted-foreground) disabled:opacity-50',
              isCompact
                ? 'p-3 min-h-[2.25rem] text-sm rounded-xl'
                : 'p-5 transition-[padding] duration-200 ease-in-out min-h-[3.025rem] max-h-[16.125rem] overflow-y-auto text-[1rem]',
            )}
          />

          {/* @mention dropdown */}
          {showMentionDropdown && filteredMentionItems.length > 0 && (
            <div
              ref={mentionDropdownRef}
              className="absolute z-100 left-3 right-3 bg-(--white) border border-(--border) rounded-xl shadow-lg max-h-60 overflow-y-auto"
              style={{ bottom: 'calc(100% + 0.5rem)' }}
            >
              {filteredMentionItems.map((item, index) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  data-index={index}
                  onClick={() => handleMentionSelect(item)}
                  className={cn(
                    'w-full px-3 py-2 text-left flex items-center gap-2 transition-colors',
                    index === selectedMentionIndex
                      ? 'bg-(--muted) border-l-2 border-(--primary)'
                      : 'hover:bg-(--muted)/50'
                  )}
                >
                  <div className="shrink-0 text-(--muted-foreground)">{getMentionIcon(item.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-caption font-medium text-(--foreground) truncate">{item.display}</div>
                    {item.content && (
                      <div className="text-caption text-(--muted-foreground) truncate mt-0.5">
                        {item.content.substring(0, 60)}...
                      </div>
                    )}
                  </div>
                  {index === selectedMentionIndex && <Check size={12} className="shrink-0 text-(--primary)" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Toolbar — before children so submit button appears above filters */}
        <div className={cn(
          'flex items-center gap-2',
          isCompact ? 'min-h-[2rem] p-2 pb-1' : 'min-h-[2.5rem] p-3 pb-2',
        )}>
          <div className="flex items-center gap-2 ml-auto">
            {isCompact ? (
              <button
                type="button"
                disabled={!value.trim() || disabled || loading}
                onClick={onSubmit}
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center transition-colors duration-150 shrink-0',
                  value.trim() && !disabled
                    ? 'border border-(--primary) text-(--primary) bg-transparent hover:bg-(--primary) hover:text-(--primary-foreground)'
                    : 'border border-(--border) text-(--muted-foreground)'
                )}
              >
                {submitIcon}
              </button>
            ) : (
              <button
                type="button"
                disabled={!value.trim() || disabled || loading}
                onClick={onSubmit}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 font-medium transition-colors duration-150 cursor-pointer shrink-0',
                  'text-code h-9 px-4',
                  'rounded-full',
                  value.trim() && !disabled
                    ? 'border-2 border-(--primary) text-(--primary) bg-transparent hover:bg-(--primary) hover:text-(--primary-foreground)'
                    : 'border border-(--border) text-(--muted-foreground)',
                )}
              >
                {submitIcon && <span className="shrink-0">{submitIcon}</span>}
                {submitLabel}
              </button>
            )}

            {/* Prompts trigger — pops over from toolbar via Popover */}
            {!isCompact && promptsCollapsible && (suggestions?.length || promptGroups?.length) && (
              <Popover>
                <PopoverTrigger className="inline-flex items-center gap-1 text-caption text-(--muted-foreground) hover:text-(--foreground) transition-colors px-2 py-1 rounded-lg hover:bg-(--muted)">
                  <span>Prompts</span>
                  <ChevronDown size={12} />
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-[calc(100vw-2rem)] sm:w-88 p-3 max-h-72 overflow-y-auto wrap-break-word">
                  <div className="space-y-3">
                    {promptGroups && promptGroups.length > 0 ? (
                      promptGroups.map((group) => {
                        const GroupIcon = group.icon;
                        return (
                          <div key={group.label}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <GroupIcon size={13} className="text-(--muted-foreground) shrink-0" />
                              <span className="text-caption font-medium text-(--muted-foreground) uppercase tracking-wider">{group.label}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {group.prompts.map((suggestion) => {
                                const IconComponent = suggestion.icon;
                                return (
                                  <button
                                    key={suggestion.text}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => { handlePromptClick(suggestion.prompt); }}
                                    className="group flex items-center gap-1.5 rounded-full border border-(--border) px-2.5 py-1 text-sm text-(--foreground) transition-colors duration-200 ease-out hover:bg-(--muted)/30 bg-transparent disabled:opacity-40"
                                  >
                                    <IconComponent size={12} className="text-(--muted-foreground) shrink-0" />
                                    <span>{suggestion.text}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions!.map((suggestion) => {
                          const IconComponent = suggestion.icon;
                          return (
                            <button
                              key={suggestion.text}
                              type="button"
                              disabled={disabled}
                              onClick={() => { handlePromptClick(suggestion.prompt); }}
                              className="group flex items-center gap-1.5 rounded-full border border-(--border) px-2.5 py-1 text-sm text-(--foreground) transition-colors duration-200 ease-out hover:bg-(--muted)/30 bg-transparent disabled:opacity-40"
                            >
                              <IconComponent size={12} className="text-(--muted-foreground) shrink-0" />
                              <span className="whitespace-nowrap">{suggestion.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Children slot — after toolbar so submit appears before filters */}
        {!isCompact && children && (
          <div className="px-5 pb-2">
            {children}
          </div>
        )}
      </div>

      {/* Suggestion prompts — hidden in compact mode */}
      {!isCompact && renderSuggestions()}
    </div>
  );
}
