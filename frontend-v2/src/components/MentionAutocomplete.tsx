import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { annotationsApi } from '@/lib/api/annotations';
import { papersApi } from '@/lib/api/papers';
import { DocumentText as FileText, Book1 as BookOpen, Stickynote as StickyNote } from 'iconsax-reactjs';

export interface MentionItem {
  id: number;
  type: 'note' | 'annotation' | 'paper';
  display: string;
  content?: string;
  title?: string;
}

interface MentionAutocompleteProps {
  paperId: number;
  value: string;
  onChange: (value: string) => void;
  onMentionSelect?: (mention: MentionItem) => void;
  onSend?: () => void;
  placeholder?: string;
  className?: string;
}

export function MentionAutocomplete({
  paperId,
  value,
  onChange,
  onMentionSelect,
  onSend,
  placeholder = 'Type a message...',
  className = '',
}: MentionAutocompleteProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea up to max-height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: annotations } = useQuery({
    queryKey: ['annotations', paperId],
    queryFn: () => annotationsApi.list(paperId),
  });

  const { data: papersData } = useQuery({
    queryKey: ['papers'],
    queryFn: () => papersApi.list(1, 100),
  });

  const buildMentionItems = useCallback((): MentionItem[] => {
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

    if (papersData?.papers) {
      papersData.papers.filter(p => p.id !== paperId).forEach(paper => {
        items.push({
          id: paper.id,
          type: 'paper',
          display: `Paper: ${paper.title}`,
          title: paper.title,
        });
      });
    }

    return items;
  }, [annotations, papersData, paperId]);

  const allMentionItems = buildMentionItems();
  const filteredItems = mentionQuery
    ? allMentionItems.filter(item => item.display.toLowerCase().includes(mentionQuery.toLowerCase()))
    : allMentionItems;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionQuery(textAfterAt);
        setMentionPosition({ start: lastAtIndex, end: cursorPos });
        setShowDropdown(true);
        setSelectedIndex(0);
        return;
      }
    }

    setShowDropdown(false);
    setMentionQuery('');
  };

  const handleMentionSelect = (item: MentionItem) => {
    const beforeMention = value.substring(0, mentionPosition.start);
    const afterMention = value.substring(mentionPosition.end);
    const mentionText = `@${item.type}{${item.id}}`;
    const newValue = beforeMention + mentionText + afterMention;

    onChange(newValue);
    setShowDropdown(false);
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
      if (showDropdown && filteredItems.length > 0) {
        handleMentionSelect(filteredItems[selectedIndex]);
      } else {
        onSend?.();
      }
      return;
    }

    if (showDropdown && filteredItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
        setMentionQuery('');
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setMentionQuery('');
      }
    };

    if (showDropdown) {
      const timeout = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timeout);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown]);

  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const selectedElement = dropdownRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, showDropdown]);

  const getIcon = (type: MentionItem['type']) => {
    switch (type) {
      case 'note': return <StickyNote size={14} />;
      case 'annotation': return <FileText size={14} />;
      case 'paper': return <BookOpen size={14} />;
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 text-code text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--ring)] resize-none overflow-y-auto min-h-[5rem] max-h-[12.5rem] ${className}`}
        rows={3}
      />

      {showDropdown && filteredItems.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-[100] w-full bg-[var(--white)] border border-[var(--border)] rounded-xl shadow-lg max-h-60 overflow-y-auto"
          style={{ bottom: 'calc(100% + 0.5rem)' }}
        >
          {filteredItems.map((item, index) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              data-index={index}
              onClick={() => handleMentionSelect(item)}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors ${
                index === selectedIndex
                  ? 'bg-[var(--muted)] border-l-2 border-[var(--primary)]'
                  : 'hover:bg-[var(--muted)]/50'
              }`}
            >
              <div className="flex-shrink-0 text-[var(--muted-foreground)]">{getIcon(item.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-caption font-medium text-[var(--foreground)] truncate">{item.display}</div>
                {item.content && (
                  <div className="text-caption text-[var(--muted-foreground)] truncate mt-0.5">
                    {item.content.substring(0, 60)}...
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
