import { useState, useEffect, useRef } from 'react';
import { SearchNormal as Search, Folder, FolderOpen, TickCircle as Check } from 'iconsax-reactjs';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { Group } from '@/lib/api/groups';

interface MovePapersDialogProps {
  open: boolean;
  onClose: () => void;
  onMove: (groupIds: number[]) => void;
  groups: Group[];
  paperCount: number;
  initialGroupIds?: number[];
  isMoving?: boolean;
}

interface GroupItemProps {
  group: Group;
  level: number;
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  search: string;
}

function matchesSearch(g: Group, q: string): boolean {
  if (!q) return true;
  if (g.name.toLowerCase().includes(q.toLowerCase())) return true;
  return g.children?.some((c) => matchesSearch(c, q)) ?? false;
}

function GroupItem({ group, level, selectedIds, onToggle, search }: GroupItemProps) {
  if (!matchesSearch(group, search)) return null;
  const isSelected = selectedIds.has(group.id);
  const hasChildren = (group.children?.length ?? 0) > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors',
          'hover:bg-[var(--muted)]',
          isSelected && 'bg-[var(--muted)]',
        )}
        style={{ paddingLeft: `${0.5 + level * 1.25}rem` }}
        onClick={() => onToggle(group.id)}
      >
        {/* Checkbox */}
        <div className={cn(
          'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0',
          isSelected
            ? 'bg-[var(--foreground)] border-[var(--foreground)]'
            : 'border-[var(--border)]',
        )}>
          {isSelected && (
            <Check size={10} className="text-[var(--background)]" strokeWidth={3} />
          )}
        </div>

        {/* Folder icon */}
        {hasChildren
          ? <FolderOpen size={14} className="text-[var(--muted-foreground)] shrink-0" />
          : <Folder size={14} className="text-[var(--muted-foreground)] shrink-0" />
        }

        <span className="text-code truncate select-none">{group.name}</span>
      </div>

      {hasChildren && group.children!.map((child) => (
        <GroupItem
          key={child.id}
          group={child}
          level={level + 1}
          selectedIds={selectedIds}
          onToggle={onToggle}
          search={search}
        />
      ))}
    </div>
  );
}

/** Build a flat group list into a parent/child tree. */
function buildTree(groups: Group[]): Group[] {
  const map = new Map<number, Group & { _kids: Group[] }>();
  const roots: (Group & { _kids: Group[] })[] = [];

  groups.forEach((g) => map.set(g.id, { ...g, children: undefined, _kids: [] }));

  map.forEach((node) => {
    if (node.parent_id != null) {
      map.get(node.parent_id)?._kids.push(node);
    } else {
      roots.push(node);
    }
  });

  function toGroup(node: Group & { _kids: Group[] }): Group {
    const { _kids, ...rest } = node;
    return { ...rest, children: _kids.length ? _kids.map(kid => toGroup(kid as Group & { _kids: Group[] })) : undefined };
  }

  return roots.map(toGroup);
}

export function MovePapersDialog({
  open,
  onClose,
  onMove,
  groups,
  paperCount,
  initialGroupIds = [],
  isMoving = false,
}: MovePapersDialogProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set(initialGroupIds));
  const [search, setSearch] = useState('');
  const prevOpen = useRef(open);

  // Reset when dialog opens
  useEffect(() => {
    if (open && !prevOpen.current) {
      setSelected(new Set(initialGroupIds));
      setSearch('');
    }
    prevOpen.current = open;
  }, [open, initialGroupIds]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const tree = buildTree(groups);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Move to Group"
      description={`Assign ${paperCount} paper${paperCount !== 1 ? 's' : ''} to one or more groups.`}
      size="md"
    >
      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
        <Input
          placeholder="Search groups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-8 text-code"
        />
      </div>

      {/* Group tree */}
      <div className="border border-[var(--border)] rounded-xl p-2 h-[17.5rem] overflow-y-auto space-y-0.5">
        {tree.length > 0 ? (
          tree.map((g) => (
            <GroupItem
              key={g.id}
              group={g}
              level={0}
              selectedIds={selected}
              onToggle={toggle}
              search={search}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--muted-foreground)]">
            <Folder size={28} className="opacity-30" />
            <span className="text-code">No groups yet</span>
          </div>
        )}
      </div>

      <p className="mt-2 text-caption text-[var(--muted-foreground)]">
        {selected.size} group{selected.size !== 1 ? 's' : ''} selected
      </p>

      <DialogFooter className="mt-4">
        <Button variant="ghost" onClick={onClose} disabled={isMoving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => onMove(Array.from(selected))}
          disabled={isMoving}
        >
          {isMoving ? 'Applying…' : 'Apply'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
