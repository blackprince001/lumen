import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Annotation } from '@/lib/api/annotations';
import type { OcrBlock } from '@/components/shadcn/layout-blocks';

export type ScrollCallbacks = {
  scrollToAnnotation: (annotation: Annotation) => void;
  scrollToBlock: (block: OcrBlock) => void;
};

type ReaderContextType = {
  scrollCallbacks: ScrollCallbacks | null;
  registerScrollCallbacks: (cbs: ScrollCallbacks) => void;
  unregisterScrollCallbacks: () => void;
  activeAnnotationId: number | null;
  setActiveAnnotationId: (id: number | null) => void;
  activeBlockId: string | undefined;
  setActiveBlockId: (id: string | undefined) => void;
};

const ReaderContext = createContext<ReaderContextType | undefined>(undefined);

export function ReaderProvider({ children }: { children: ReactNode }) {
  const [scrollCallbacks, setScrollCallbacks] = useState<ScrollCallbacks | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<number | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | undefined>(undefined);

  const registerScrollCallbacks = useCallback((cbs: ScrollCallbacks) => {
    setScrollCallbacks(cbs);
  }, []);

  const unregisterScrollCallbacks = useCallback(() => {
    setScrollCallbacks(null);
  }, []);

  return (
    <ReaderContext.Provider
      value={{
        scrollCallbacks,
        registerScrollCallbacks,
        unregisterScrollCallbacks,
        activeAnnotationId,
        setActiveAnnotationId,
        activeBlockId,
        setActiveBlockId,
      }}
    >
      {children}
    </ReaderContext.Provider>
  );
}

export function useReader() {
  const context = useContext(ReaderContext);
  if (context === undefined) {
    throw new Error('useReader must be used within a ReaderProvider');
  }
  return context;
}
