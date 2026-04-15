import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface ConfirmDialogProps {
  open: boolean;
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, options, onConfirm, onCancel }: ConfirmDialogProps) {
  const { title = 'Are you sure?', description, confirmLabel = 'Confirm', destructive = false } = options;

  return (
    <Dialog open={open} onClose={onCancel} title={title} description={description} size="sm">
      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'primary'}
          size="sm"
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export { useConfirmDialog } from '@/hooks/use-confirm-dialog';
