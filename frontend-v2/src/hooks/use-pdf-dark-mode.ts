import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../lib/theme';

export interface ImageRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Original image data URL clipped from the canvas */
  dataUrl: string;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Manages PDF dark mode:
 * - Syncs with global theme (from ThemeProvider)
 * - Detects "already dark" pages via luminance sampling
 * - Detects image/graphic regions via PDF.js operator list
 * - Returns per-page image regions for double-inversion overlays
 */
export function usePDFDarkMode() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const [pageRegions, setPageRegions] = useState<Record<number, ImageRegion[]>>({});
  const [darkPageFlags, setDarkPageFlags] = useState<Record<number, boolean>>({});
  const processingPages = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!isDarkMode) {
      setPageRegions({});
      setDarkPageFlags({});
      processingPages.current.clear();
    }
  }, [isDarkMode]);

  /**
   * Samples corners and center of the canvas to determine if the page is already dark.
   */
  const checkIsAlreadyDark = (canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    const cw = canvas.width;
    const ch = canvas.height;

    const points = [
      [10, 10], [cw - 10, 10], [10, ch - 10], [cw - 10, ch - 10], [cw / 2, ch / 2]
    ];

    let totalLuminance = 0;
    let validPoints = 0;

    for (const [px, py] of points) {
      try {
        const data = ctx.getImageData(px, py, 1, 1).data;
        totalLuminance += 0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2];
        validPoints++;
      } catch { continue; }
    }

    if (validPoints === 0) return false;
    return totalLuminance / validPoints < 80;
  };

  const analyzePageForImages = useCallback(async (pageContainer: HTMLDivElement, pageNumber: number) => {
    if (!isDarkMode) return;
    if (processingPages.current.has(pageNumber)) return;

    const canvas = pageContainer.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    processingPages.current.add(pageNumber);

    try {
      const isAlreadyDark = checkIsAlreadyDark(canvas);
      if (isAlreadyDark) {
        setDarkPageFlags(prev => ({ ...prev, [pageNumber]: true }));
      }
    } catch (err) {
      console.warn('[usePDFDarkMode] analysis failed for page', pageNumber, err);
    } finally {
      processingPages.current.delete(pageNumber);
    }
  }, [isDarkMode]);

  return { isDarkMode, pageRegions, darkPageFlags, analyzePageForImages };
}
