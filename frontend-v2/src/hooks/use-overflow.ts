import { useState, useRef, useEffect } from 'react';

const DOTS_RESERVE = 36;

function calcHidden(
  entries: { id: string; width: number }[],
  available: number,
): string[] {
  const hidden: string[] = [];
  let used = 0;
  for (const entry of entries) {
    const next = used + entry.width;
    if (next > available) {
      hidden.push(entry.id);
    } else {
      used = next;
    }
  }
  return hidden;
}

export function useOverflow() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hiddenSections, setHiddenSections] = useState<string[]>([]);
  const rafRef = useRef<number>(0);
  const prevRef = useRef<string[]>([]);

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;

      const sectionEls = Array.from(
        el.querySelectorAll('[data-section]:not([data-section="dots"])'),
      ) as HTMLElement[];

      const entries = sectionEls.map((s) => ({
        id: s.dataset.section || '',
        width: s.offsetWidth || 0,
      }));

      // Pass 1 — without dots reservation
      const noDotsHidden = calcHidden(entries, el.clientWidth);

      // If items overflow without dots, rerun with dots space reserved.
      // This avoids a feedback loop: dots DOM width is never read, only a
      // constant reservation is used.
      const hidden =
        noDotsHidden.length > 0
          ? calcHidden(entries, el.clientWidth - DOTS_RESERVE)
          : [];

      const prev = prevRef.current;
      if (
        hidden.length !== prev.length ||
        !hidden.every((id, i) => id === prev[i])
      ) {
        prevRef.current = hidden;
        setHiddenSections(hidden);
      }
    };

    rafRef.current = requestAnimationFrame(measure);

    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { containerRef, hiddenSections };
}
