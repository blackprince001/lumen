import { useState, useCallback, useRef } from 'react';

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface ConfirmDialogState {
  open: boolean;
  options: ConfirmOptions;
}

const DEFAULT_OPTIONS: ConfirmOptions = { description: '' };

/**
 * Programmatic confirm dialog.
 *
 * Usage:
 *   const { confirm, dialogProps } = useConfirmDialog();
 *   const ok = await confirm({ description: 'Delete this paper?' });
 *
 * Pair with <ConfirmDialog {...dialogProps} /> somewhere in the tree.
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({ open: false, options: DEFAULT_OPTIONS });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setState({ open: true, options });
    return new Promise((resolve) => { resolveRef.current = resolve; });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    confirm,
    dialogProps: {
      open: state.open,
      options: state.options,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}
