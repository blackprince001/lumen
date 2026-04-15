import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi } from '@/lib/api/groups';
import { Edit as Edit2, Trash as Trash2, Add as Plus, Message as MessageSquare, Folder } from 'iconsax-reactjs';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { PaperCard } from '@/components/PaperCard';
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog';
import { MovePapersDialog } from '@/components/MovePapersDialog';
import { GroupChatSidebar } from '@/components/GroupChatSidebar';
import { toastSuccess, toastError } from '@/lib/utils/toast';

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const groupId = id ? parseInt(id) : undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, dialogProps } = useConfirmDialog();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [isAddPapersOpen, setIsAddPapersOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => groupsApi.get(groupId!),
    enabled: false, // Disable - we'll use allGroups instead
    retry: false,
  });

  // Fetch all groups to find children and as fallback
  const { data: allGroups, isLoading: allGroupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });

  // Use fetched group or fallback to finding it in allGroups
  const displayGroup = group || allGroups?.find(g => g.id === groupId);
  const papers = displayGroup?.papers || [];
  const childGroups = allGroups?.filter((g) => g.parent_id === groupId) || [];

  // Build breadcrumb path
  const breadcrumbs = [];
  if (displayGroup && allGroups) {
    let current: typeof displayGroup | undefined = displayGroup;
    while (current) {
      breadcrumbs.unshift(current);
      current = current.parent_id ? allGroups.find(g => g.id === current!.parent_id) : undefined;
    }
  }

  // Debug logging
  useEffect(() => {
    if (displayGroup) {
      console.log('Display Group:', displayGroup);
      console.log('Papers:', papers);
      console.log('Child groups:', childGroups);
    }
  }, [displayGroup, papers, childGroups]);

  const updateMutation = useMutation({
    mutationFn: (name: string) => groupsApi.update(groupId!, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setIsEditOpen(false);
      toastSuccess('Group updated');
    },
    onError: () => toastError('Failed to update group'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => groupsApi.delete(groupId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toastSuccess('Group deleted');
      navigate('/groups');
    },
    onError: () => toastError('Failed to delete group'),
  });

  const handleEdit = () => {
    if (displayGroup) {
      setEditName(displayGroup.name);
      setIsEditOpen(true);
    }
  };

  const handleUpdate = () => {
    if (editName.trim()) {
      updateMutation.mutate(editName.trim());
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Group',
      description: 'Are you sure you want to delete this group? Papers will not be deleted.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deleteMutation.mutate();
  };

  if (!groupId) {
    return (
      <div className="max-w-content mx-auto px-6 py-8">
        <p className="text-[var(--destructive)]">Invalid group ID</p>
      </div>
    );
  }

  if (groupLoading || allGroupsLoading) {
    return (
      <div className="max-w-content mx-auto px-6 py-8">
        <Skeleton className="w-48 h-8 mb-2" />
        <Skeleton className="w-96 h-5 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="w-full h-64" />)}
        </div>
      </div>
    );
  }

  if (!displayGroup) {
    return (
      <div className="max-w-content mx-auto px-6 py-8">
        <p className="text-[var(--destructive)]">Group not found</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-content mx-auto px-6 py-8">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <div className="flex items-center gap-2 text-code text-[var(--muted-foreground)] mb-4">
            <Link to="/groups" className="hover:text-[var(--foreground)]">
              Library
            </Link>
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.id} className="flex items-center gap-2">
                <span>/</span>
                {index === breadcrumbs.length - 1 ? (
                  <span className="text-[var(--foreground)] font-medium">{crumb.name}</span>
                ) : (
                  <Link to={`/groups/${crumb.id}`} className="hover:text-[var(--foreground)]">
                    {crumb.name}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1">
            <h1>{displayGroup.name}</h1>
            <p className="text-btn text-[var(--muted-foreground)] mt-1">
              {papers.length} {papers.length === 1 ? 'paper' : 'papers'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {papers.length > 0 && (
              <Button variant="secondary" icon={<MessageSquare size={14} />} onClick={() => setIsChatOpen(true)}>
                Chat with Group
              </Button>
            )}
            <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setIsAddPapersOpen(true)}>
              Add Papers
            </Button>
            <Button variant="ghost" className="!h-9 !w-9 !p-0" onClick={handleEdit}>
              <Edit2 size={16} />
            </Button>
            <Button variant="ghost" className="!h-9 !w-9 !p-0 text-[var(--destructive)]" onClick={handleDelete}>
              <Trash2 size={16} />
            </Button>
          </div>
        </div>

        {/* Child Groups */}
        {childGroups.length > 0 && (
          <div className="mb-8">
            <h2 className="text-subheading font-medium mb-4">Folders</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {childGroups.map((child) => (
                <Link
                  key={child.id}
                  to={`/groups/${child.id}`}
                  className="flex items-center gap-3 p-4 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                >
                  <Folder size={20} className="text-[var(--muted-foreground)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-body truncate">{child.name}</h3>
                    <p className="text-caption text-[var(--muted-foreground)]">
                      {child.papers?.length || 0} papers
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Papers grid */}
        {groupLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="w-full h-64" />)}
          </div>
        ) : papers.length === 0 && childGroups.length === 0 ? (
          <div className="text-center py-12 text-[var(--muted-foreground)]">
            <p className="text-body mb-4">No papers or folders in this group yet</p>
            <Button icon={<Plus size={14} />} onClick={() => setIsAddPapersOpen(true)}>
              Add Papers
            </Button>
          </div>
        ) : papers.length > 0 ? (
          <div>
            <h2 className="text-subheading font-medium mb-4">Papers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {papers.map((paper) => (
                <PaperCard key={paper.id} paper={paper} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Group">
        <div className="space-y-4">
          <div>
            <label className="block text-code font-medium mb-1.5">Name</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Group name"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUpdate} disabled={!editName.trim()}>
              Update
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Add Papers Dialog */}
      {isAddPapersOpen && (
        <MovePapersDialog
          open={isAddPapersOpen}
          onClose={() => setIsAddPapersOpen(false)}
          onMove={() => setIsAddPapersOpen(false)}
          groups={allGroups ?? []}
          paperCount={0}
        />
      )}

      {/* Group Chat Sidebar */}
      {isChatOpen && (
        <GroupChatSidebar
          groupId={groupId}
          groupName={displayGroup.name}
          onClose={() => setIsChatOpen(false)}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </>
  );
}
