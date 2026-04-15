import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { papersApi } from '@/lib/api/papers';

/** Compute active reading minutes from a start time, excluding accumulated pauses. */
function calcDurationMinutes(
  startTime: Date,
  accumulatedPauseMs: number,
  currentPauseStart: Date | null
): number {
  const now = Date.now();
  const totalPaused = accumulatedPauseMs + (currentPauseStart ? now - currentPauseStart.getTime() : 0);
  return Math.max(0, Math.floor((now - startTime.getTime() - totalPaused) / 60_000));
}

export function useReadingSession(paperId: number, isActive: boolean, currentPage: number) {
  const queryClient = useQueryClient();

  // Refs hold mutable session state — no re-renders needed for tracking internals
  const startTimeRef      = useRef<Date | null>(null);
  const sessionPaperRef   = useRef<number | null>(null);
  const pagesViewedRef    = useRef<Set<number>>(new Set());
  const lastPageRef       = useRef(currentPage);
  const pausedMsRef       = useRef(0);
  const pauseStartRef     = useRef<Date | null>(null);
  const prevPaperIdRef    = useRef<number | null>(null);

  const [isTracking, setIsTracking] = useState(false);

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const startMutation = useMutation({
    mutationFn: () => papersApi.startReadingSession(paperId),
    onSuccess: () => {
      startTimeRef.current    = new Date();
      sessionPaperRef.current = paperId;
      pausedMsRef.current     = 0;
      pauseStartRef.current   = null;
      pagesViewedRef.current  = new Set([currentPage]);
      lastPageRef.current     = currentPage;
      setIsTracking(true);
    },
  });

  const endMutation = useMutation({
    mutationFn: ({ pagesViewed, lastPage }: { pagesViewed: number; lastPage: number }) =>
      papersApi.endReadingSession(paperId, {
        duration_minutes: startTimeRef.current
          ? calcDurationMinutes(startTimeRef.current, pausedMsRef.current, pauseStartRef.current)
          : 0,
        pages_viewed: pagesViewed,
        last_read_page: lastPage,
      }),
    onSuccess: () => {
      startTimeRef.current    = null;
      sessionPaperRef.current = null;
      pausedMsRef.current     = 0;
      pauseStartRef.current   = null;
      pagesViewedRef.current.clear();
      setIsTracking(false);
      queryClient.invalidateQueries({ queryKey: ['paper', paperId] });
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  // ─── Fire-and-forget end (paper change / unmount) ──────────────────────────

  function endSilently(targetPaperId: number) {
    if (!startTimeRef.current) return;
    papersApi.endReadingSession(targetPaperId, {
      duration_minutes: calcDurationMinutes(startTimeRef.current, pausedMsRef.current, pauseStartRef.current),
      pages_viewed: pagesViewedRef.current.size,
      last_read_page: lastPageRef.current,
    }).catch(() => {/* ignore */});
    queryClient.invalidateQueries({ queryKey: ['paper', targetPaperId] });
    queryClient.invalidateQueries({ queryKey: ['papers'] });
    queryClient.invalidateQueries({ queryKey: ['statistics'] });
    startTimeRef.current    = null;
    sessionPaperRef.current = null;
    pausedMsRef.current     = 0;
    pauseStartRef.current   = null;
    pagesViewedRef.current.clear();
    setIsTracking(false);
  }

  // ─── Visibility (pause / resume) ─────────────────────────────────────────

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!startTimeRef.current || !isTracking) return;
      if (document.hidden) {
        pauseStartRef.current = new Date();
      } else if (pauseStartRef.current) {
        pausedMsRef.current += Date.now() - pauseStartRef.current.getTime();
        pauseStartRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isTracking]);

  // ─── Paper change → end old session ─────────────────────────────────────

  useEffect(() => {
    const prev = prevPaperIdRef.current;
    if (prev !== null && prev !== paperId && startTimeRef.current) {
      endSilently(sessionPaperRef.current ?? prev);
    }
    prevPaperIdRef.current = paperId;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

  // ─── Activation → start session ──────────────────────────────────────────

  useEffect(() => {
    if (isActive && !startTimeRef.current && paperId > 0 && sessionPaperRef.current !== paperId) {
      startMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, paperId]);

  // ─── Page tracking ───────────────────────────────────────────────────────

  useEffect(() => {
    if (isActive && startTimeRef.current && currentPage !== lastPageRef.current) {
      pagesViewedRef.current.add(currentPage);
      lastPageRef.current = currentPage;
    }
  }, [currentPage, isActive]);

  // ─── Deactivation → end session ──────────────────────────────────────────

  useEffect(() => {
    if (!isActive && startTimeRef.current && sessionPaperRef.current === paperId) {
      endMutation.mutate({
        pagesViewed: pagesViewedRef.current.size,
        lastPage: lastPageRef.current,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, paperId]);

  // ─── Unmount cleanup ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (startTimeRef.current) {
        endSilently(sessionPaperRef.current ?? paperId);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isTracking };
}
