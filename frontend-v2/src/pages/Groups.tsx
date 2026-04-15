import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { groupsApi, type Group } from '@/lib/api/groups';
import { Add as Plus, DocumentText as FileText, FolderOpen, Edit as Edit2, Trash as Trash2, DocumentDownload } from 'iconsax-reactjs';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog';
import { getPaperTheme, type PaperTheme } from '@/lib/paper-themes';
import { toastSuccess, toastError } from '@/lib/utils/toast';

interface FolderCardProps {
  group: Group;
  theme: PaperTheme;
  onEdit: (group: Group) => void;
  onDelete: (id: number) => void;
  onExport: (group: Group) => void;
}

function FolderCard({ group, theme, onEdit, onDelete, onExport }: FolderCardProps) {
  const [hovered, setHovered] = useState(false);

  const bg = hovered ? theme.bg : 'var(--card)';
  const border = hovered ? theme.border : 'var(--border)';
  const textColor = hovered ? theme.text : 'var(--foreground)';
  const mutedColor = hovered ? theme.text : 'var(--muted-foreground)';
  const accentBg = hovered ? theme.accent : 'var(--muted)';

  return (
    <div
      className="relative pt-[1.75rem] transition-all duration-200 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tab */}
      <div
        className="absolute top-0 left-0 w-[7.5rem] h-[1.875rem] rounded-t-[0.5625rem]"
        style={{
          backgroundColor: bg,
          border: `1px solid ${border}`,
          borderBottom: 'none',
          transition: 'background-color 200ms, border-color 200ms',
        }}
      />

      {/* Folder body */}
      <Link to={`/groups/${group.id}`}>
        <div
          className="relative w-full p-6"
          style={{
            backgroundColor: bg,
            border: `1px solid ${border}`,
            borderRadius: '0 0.875rem 0.875rem 0.875rem',
            transition: 'background-color 200ms, border-color 200ms',
          }}
        >
          <div className="flex items-start gap-3 mb-5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200"
              style={{ backgroundColor: accentBg }}
            >
              <FolderOpen size={20} style={{ color: mutedColor, transition: 'color 200ms' }} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-btn font-semibold leading-snug truncate transition-colors duration-200"
                style={{ color: textColor }}
              >
                {group.name}
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-1.5 text-caption font-medium transition-colors duration-200"
            style={{ color: mutedColor, opacity: 0.75 }}
          >
            <FileText size={13} />
            <span>{group.papers?.length || group.paper_count || 0} papers</span>
          </div>
        </div>
      </Link>

      {/* Action buttons */}
      <div className="absolute top-10 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        {(group.paper_count ?? group.papers?.length ?? 0) > 0 && (
          <Button
            variant="ghost"
            className="!h-7 !w-7 !p-0 bg-[var(--white)] shadow-sm"
            onClick={(e) => {
              e.preventDefault();
              onExport(group);
            }}
          >
            <DocumentDownload size={14} />
          </Button>
        )}
        <Button
          variant="ghost"
          className="!h-7 !w-7 !p-0 bg-[var(--white)] shadow-sm"
          onClick={(e) => {
            e.preventDefault();
            onEdit(group);
          }}
        >
          <Edit2 size={14} />
        </Button>
        <Button
          variant="ghost"
          className="!h-7 !w-7 !p-0 bg-[var(--white)] shadow-sm text-[var(--destructive)]"
          onClick={(e) => {
            e.preventDefault();
            onDelete(group.id);
          }}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

export default function Groups() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { confirm, dialogProps } = useConfirmDialog();

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => groupsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setIsCreateOpen(false);
      setFormData({ name: '' });
      toastSuccess('Group created');
    },
    onError: () => toastError('Failed to create group'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string } }) =>
      groupsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setEditingGroup(null);
      setFormData({ name: '' });
      toastSuccess('Group updated');
    },
    onError: () => toastError('Failed to update group'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => groupsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toastSuccess('Group deleted');
    },
    onError: () => toastError('Failed to delete group'),
  });

  const handleCreate = () => {
    if (formData.name.trim())
    {
      createMutation.mutate({ name: formData.name.trim() });
    }
  };

  const handleUpdate = () => {
    if (editingGroup && formData.name.trim())
    {
      updateMutation.mutate({
        id: editingGroup.id,
        data: { name: formData.name.trim() },
      });
    }
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData({ name: group.name });
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Delete Group',
      description: 'Are you sure you want to delete this group? Papers will not be deleted.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deleteMutation.mutate(id);
  };

  const handleExport = (group: Group) => {
    const paperIds = group.papers?.map(p => p.id) ?? [];
    navigate('/export', { state: { paperIds, returnPath: '/groups' } });
  };

  const closeDialog = () => {
    setIsCreateOpen(false);
    setEditingGroup(null);
    setFormData({ name: '' });
  };

  if (isLoading)
  {
    return (
      <div className="max-w-content mx-auto px-6 py-8">
        <Skeleton className="w-48 h-8 mb-2" />
        <Skeleton className="w-96 h-5 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="w-full h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-content mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1>Groups</h1>
            <p className="text-btn text-[var(--muted-foreground)] mt-1">
              Organize your papers into collections
            </p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setIsCreateOpen(true)}>
            New Group
          </Button>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-12 text-[var(--muted-foreground)]">
            <FolderOpen size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-body mb-4">No groups yet</p>
            <Button icon={<Plus size={14} />} onClick={() => setIsCreateOpen(true)}>
              Create Your First Group
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.filter(g => g.parent_id == null).map((group, index) => (
              <FolderCard
                key={group.id}
                group={group}
                theme={getPaperTheme(index)}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onExport={handleExport}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateOpen || !!editingGroup}
        onClose={closeDialog}
        title={editingGroup ? 'Edit Group' : 'Create Group'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-code font-medium mb-1.5">Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ name: e.target.value })}
              placeholder="e.g., Machine Learning"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={editingGroup ? handleUpdate : handleCreate}
              disabled={!formData.name.trim()}
            >
              {editingGroup ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
    </>
  );
}
