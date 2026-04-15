import { useState, useEffect, useCallback, useRef } from 'react';
import Tesseract from 'tesseract.js';
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
 * - Detects image/graphic regions via PDF.js operator list (Veil approach)
 * - Fallback to Tesseract.js OCR for scanned/image-only documents
 * - Returns per-page image regions for double-inversion overlays
 */
export function usePDFDarkMode() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  // page → detected image regions
  const [pageRegions, setPageRegions] = useState<Record<number, ImageRegion[]>>({});
  const [darkPageFlags, setDarkPageFlags] = useState<Record<number, boolean>>({});
  const processingPages = useRef<Set<number>>(new Set());

  // Clear everything when dark mode is disabled
  useEffect(() => {
    if (!isDarkMode) {
      setPageRegions({});
      setDarkPageFlags({});
      processingPages.current.clear();
    }
  }, [isDarkMode]);

  /**
   * Samples corners and edges of the canvas to determine if the page is already dark.
   * Based on BT.601 formula: Y = 0.299R + 0.587G + 0.114B
   */
  const checkIsAlreadyDark = (canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    const cw = canvas.width;
    const ch = canvas.height;
    
    // Sample points: 4 corners + center
    const points = [
      [10, 10], [cw - 10, 10], [10, ch - 10], [cw - 10, ch - 10], [cw / 2, ch / 2]
    ];

    let totalLuminance = 0;
    let validPoints = 0;

    for (const [px, py] of points) {
      try {
        const data = ctx.getImageData(px, py, 1, 1).data;
        // L = 0.299R + 0.587G + 0.114B
        const L = (0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2]);
        totalLuminance += L;
        validPoints++;
      } catch { continue; }
    }

    if (validPoints === 0) return false;
    const avgL = totalLuminance / validPoints;
    
    // If average luminance is low (< 80 out of 255), we consider it "already dark"
    return avgL < 80;
  };

  /**
   * Fast detection of images/graphics using the PDF.js operator list.
   * Returns detected regions in canvas-space coordinates.
   */
  const detectAssetRegionsViaOps = async (pageProxy: any, canvas: HTMLCanvasElement): Promise<ImageRegion[]> => {
    const ops = await pageProxy.getOperatorList();
    // PDF.js operator codes for images/drawings
    // paintImageXObject, paintInlineImageXObject, paintImageMaskXObject, etc.
    const imageOpCodes = [
      85, // paintImageXObject
      82, // paintImageMaskXObject
      92, // paintInlineImageXObject
    ];

    // Note: Walking operators for bounding boxes is complex as it depends on current transformation matrix (CTM).
    // For now, we'll try a simplified version or rely on Tesseract if this is too complex to implement perfectly
    // in one go without heavy PDF.js internal knowledge. 
    // However, we can detect IF images exist to trigger OCR Fallback logic.
    
    let hasImages = false;
    for (const opCode of ops.fnArray) {
      if (imageOpCodes.includes(opCode)) {
        hasImages = true;
        break;
      }
    }

    if (!hasImages) return [];

    // Fallback to Tesseract if we detected images but need coordinates
    // (Improved coordinate detection via operators is a future enhancement)
    return runOCR(canvas);
  };

  const runOCR = async (canvas: HTMLCanvasElement): Promise<ImageRegion[]> => {
    const { data } = await Tesseract.recognize(canvas, 'eng', { logger: () => {} });
    const cw = canvas.width;
    const ch = canvas.height;
    const regions: ImageRegion[] = [];

    const IMAGE_BLOCK_TYPES = new Set(['FLOWING_IMAGE', 'HEADING_IMAGE', 'PULLOUT_IMAGE']);

    for (const block of data.blocks ?? []) {
      if (!IMAGE_BLOCK_TYPES.has(block.blocktype ?? '')) continue;
      const { x0, y0, x1, y1 } = block.bbox;
      if (x1 - x0 < 4 || y1 - y0 < 4) continue;

      const offscreen = document.createElement('canvas');
      offscreen.width = x1 - x0;
      offscreen.height = y1 - y0;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
        regions.push({ x0, y0, x1, y1, dataUrl: offscreen.toDataURL(), canvasWidth: cw, canvasHeight: ch });
      }
    }
    return regions;
  };

  /** Called after page render */
  const analyzePageForImages = useCallback(async (pageContainer: HTMLDivElement, pageNumber: number, pageProxy?: any) => {
    if (!isDarkMode) return;
    if (processingPages.current.has(pageNumber)) return;

    const canvas = pageContainer.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    processingPages.current.add(pageNumber);

    try {
      // 1. Check if page is already dark
      const isAlreadyDark = checkIsAlreadyDark(canvas);
      if (isAlreadyDark) {
        setDarkPageFlags(prev => ({ ...prev, [pageNumber]: true }));
        return;
      }

      // 2. Detect assets
      let regions: ImageRegion[] = [];
      if (pageProxy) {
        regions = await detectAssetRegionsViaOps(pageProxy, canvas);
      } else {
        regions = await runOCR(canvas);
      }

      setPageRegions(prev => ({ ...prev, [pageNumber]: regions }));
    } catch (err) {
      console.warn('[usePDFDarkMode] analysis failed for page', pageNumber, err);
    } finally {
      processingPages.current.delete(pageNumber);
    }
  }, [isDarkMode]);

  return { isDarkMode, pageRegions, darkPageFlags, analyzePageForImages };
}
