import { useEffect, useRef, useState } from 'react';

export function useTypewriter(
  target: string,
  flush = false,
  opts: { charsPerSecond?: number; catchupMs?: number } = {},
): string {
  const { charsPerSecond = 120, catchupMs = 220 } = opts;

  const [displayed, setDisplayed] = useState('');
  const targetRef = useRef(target);
  const lenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  useEffect(() => {
    targetRef.current = target;

    if (target.length < lenRef.current) {
      lenRef.current = 0;
      setDisplayed('');
    }

    if (flush) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lenRef.current = target.length;
      setDisplayed(target);
      return;
    }

    if (lenRef.current >= target.length) return; // nothing new to reveal

    const tick = (ts: number) => {
      const full = targetRef.current;
      const remaining = full.length - lenRef.current;
      if (remaining <= 0) {
        rafRef.current = null;
        lastTsRef.current = 0;
        return;
      }

      const dt = lastTsRef.current ? ts - lastTsRef.current : 16;
      lastTsRef.current = ts;

      const baseline = (charsPerSecond / 1000) * dt;
      const catchup = (remaining / catchupMs) * dt;
      const step = Math.max(1, Math.ceil(baseline + catchup));

      lenRef.current = Math.min(full.length, lenRef.current + step);
      setDisplayed(full.slice(0, lenRef.current));

      if (lenRef.current < full.length) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        lastTsRef.current = 0;
      }
    };

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTsRef.current = 0;
      }
    };
  }, [target, flush, charsPerSecond, catchupMs]);

  return displayed;
}

export default useTypewriter;
