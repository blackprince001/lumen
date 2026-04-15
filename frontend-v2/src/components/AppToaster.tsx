import { Toaster } from 'sonner';
import { useTheme } from '../lib/theme';

/**
 * Themed toast container.
 *
 * Sonner's `theme` prop drives its internal color tokens, but the
 * actual visual polish — typography, radius, shadow, icon tints —
 * comes from the CSS overrides in index.css ([data-sonner-toast]).
 * Those rules reference our design-system CSS variables, so they
 * automatically adapt to light / dark without any JS.
 */
export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      gap={8}
      visibleToasts={4}
      closeButton
      richColors={false}
    />
  );
}
