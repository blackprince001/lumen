import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { paperSharingApi, groupSharingApi, type SharePermission, type ShareRecipient } from '@/lib/api/sharing';
import { Trash, UserAdd } from 'iconsax-reactjs';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  resourceId: number;
  resourceType: 'paper' | 'group';
  resourceTitle: string;
}

export function ShareDialog({ open, onClose, resourceId, resourceType, resourceTitle }: ShareDialogProps) {
  const [emailInput, setEmailInput] = useState('');
  const [permission, setPermission] = useState<SharePermission>('viewer');
  const [feedback, setFeedback] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const sharingApi = resourceType === 'paper' ? paperSharingApi : groupSharingApi;
  const queryKey = [resourceType, resourceId, 'shares'];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => sharingApi.list(resourceId),
    enabled: open,
  });

  const shareMutation = useMutation({
    mutationFn: (emails: string[]) => sharingApi.share(resourceId, emails, permission),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      setEmailInput('');
      const parts: string[] = [];
      if (result.shares.length) parts.push(`Shared with ${result.shares.length} user(s)`);
      if (result.missing_emails.length) parts.push(`Not found: ${result.missing_emails.join(', ')}`);
      if (result.skipped_emails.length) parts.push(`Skipped (self): ${result.skipped_emails.join(', ')}`);
      setFeedback(parts.join('. '));
    },
    onError: (err: Error) => setFeedback(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, perm }: { userId: number; perm: SharePermission }) =>
      sharingApi.update(resourceId, userId, perm),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: number) => sharingApi.revoke(resourceId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const handleShare = () => {
    const emails = emailInput.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
    if (!emails.length) return;
    setFeedback(null);
    shareMutation.mutate(emails);
  };

  const shares = data?.shares ?? [];

  return (
    <Dialog open={open} onClose={onClose} title={`Share "${resourceTitle}"`} size="lg">
      <div className="space-y-4">
        {/* Add recipients */}
        <div className="flex gap-2">
          <input
            type="text"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleShare()}
            placeholder="Enter email addresses (comma-separated)"
            className="flex-1 px-3 py-2 text-body border border-[var(--border)] rounded-interactive bg-[var(--white)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
          />
          <div className="w-32 shrink-0">
            <Select
              value={permission}
              onChange={(e) => setPermission(e.target.value as SharePermission)}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </Select>
          </div>
          <Button onClick={handleShare} disabled={shareMutation.isPending || !emailInput.trim()}>
            <UserAdd size={16} />
            Share
          </Button>
        </div>

        {feedback && (
          <p className="text-caption text-[var(--muted-foreground)]">{feedback}</p>
        )}

        {/* Current shares */}
        {isLoading ? (
          <p className="text-caption text-[var(--muted-foreground)]">Loading shares...</p>
        ) : shares.length === 0 ? (
          <p className="text-caption text-[var(--muted-foreground)]">Not shared with anyone yet.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-caption font-medium text-[var(--muted-foreground)]">Shared with</p>
            {shares.map((share: ShareRecipient) => (
              <div key={share.user_id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-interactive hover:bg-[var(--muted)]">
                <div className="flex flex-col min-w-0">
                  <span className="text-body font-medium text-[var(--foreground)] truncate">{share.display_name}</span>
                  <span className="text-caption text-[var(--muted-foreground)] truncate">{share.email}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-28">
                    <Select
                      value={share.permission}
                      onChange={(e) => updateMutation.mutate({ userId: share.user_id, perm: e.target.value as SharePermission })}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </Select>
                  </div>
                  <button
                    onClick={() => revokeMutation.mutate(share.user_id)}
                    className="p-1 rounded-interactive text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors"
                    aria-label={`Remove ${share.display_name}`}
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
