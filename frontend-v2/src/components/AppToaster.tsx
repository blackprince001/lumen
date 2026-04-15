import { Toaster } from 'sonner';
import { useTheme } from '../lib/theme';
import { useEffect, useState } from 'react';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export function AppToaster() {
  const { theme } = useTheme();
  const isMobile = useIsMobile();

  return (
    <Toaster
      theme={theme}
      position={isMobile ? 'bottom-center' : 'bottom-right'}
      gap={8}
      visibleToasts={4}
      closeButton
      richColors={false}
    />
  );
}
