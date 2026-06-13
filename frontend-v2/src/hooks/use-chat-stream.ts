import { useState, useRef, useCallback, useEffect } from 'react';
import { chatStreamClient } from '@/lib/ai/chatStream';
import type { ChatReferences } from '@/lib/api/chat';
import { logger } from '@/lib/logger';

export type ChatStreamStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'thinking'
  | 'using_tool'
  | 'done'
  | 'error';

export interface ToolCallEvent {
  tool: string;
  arguments: Record<string, unknown>;
  timestamp: number;
}

export interface ToolResultEvent {
  tool: string;
  result: string;
  timestamp: number;
}

export interface ThoughtEvent {
  content: string;
  timestamp: number;
}

export interface ChatStreamError {
  message: string;
  code: string;
  recoverable: boolean;
}

export interface ChatStreamState {
  status: ChatStreamStatus;
  content: string;
  displayedContent: string;
  thoughts: ThoughtEvent[];
  toolCalls: ToolCallEvent[];
  toolResults: ToolResultEvent[];
  currentTool: string | null;
  error: ChatStreamError | null;
  messageId: number | null;
  sessionId: number | null;
}

const INITIAL_STATE: ChatStreamState = {
  status: 'idle',
  content: '',
  displayedContent: '',
  thoughts: [],
  toolCalls: [],
  toolResults: [],
  currentTool: null,
  error: null,
  messageId: null,
  sessionId: null,
};

export interface UseChatStreamReturn extends ChatStreamState {
  /** Send a message and start streaming. */
  send: (
    paperId: number,
    message: string,
    references?: ChatReferences,
    sessionId?: number,
    providerId?: number,
  ) => void;
  /** Cancel the current stream (abort). */
  cancel: () => void;
  /** Retry the last send after an error. */
  retry: () => void;
  /** Reset state to idle. */
  reset: () => void;
  /** Whether a send is currently in progress. */
  isActive: boolean;
  /** The user message that was sent (preserved for retry). */
  pendingUserMessage: string | null;
}

const WORDS_PER_SECOND = 12;
const WORD_REVEAL_DELAY_MS = 1000 / WORDS_PER_SECOND;

export function useChatStream(): UseChatStreamReturn {
  const [state, setState] = useState<ChatStreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const lastSendRef = useRef<{
    paperId: number;
    message: string;
    references?: ChatReferences;
    sessionId?: number;
    providerId?: number;
  } | null>(null);
  const pendingUserMessageRef = useRef<string | null>(null);
  const displayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accumulatedContentRef = useRef('');

  // ---- Word-by-word display reveal ----

  useEffect(() => {
    const content = state.content;
    if (content.length > state.displayedContent.length) {
      if (displayTimerRef.current) clearInterval(displayTimerRef.current);

      displayTimerRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.displayedContent.length >= prev.content.length) {
            if (displayTimerRef.current) {
              clearInterval(displayTimerRef.current);
              displayTimerRef.current = null;
            }
            return prev;
          }
          const remaining = prev.content.slice(prev.displayedContent.length);
          const wordMatch = remaining.match(/^(\s*\S+)/);
          return {
            ...prev,
            displayedContent: wordMatch
              ? prev.displayedContent + wordMatch[1]
              : prev.content,
          };
        });
      }, WORD_REVEAL_DELAY_MS);
    }

    return () => {
      if (displayTimerRef.current) {
        clearInterval(displayTimerRef.current);
        displayTimerRef.current = null;
      }
    };
  }, [state.content, state.displayedContent.length, state.status]);

  // ---- Core send logic ----

  const runStream = useCallback(
    async (
      paperId: number,
      message: string,
      references?: ChatReferences,
      sessionId?: number,
      providerId?: number,
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      lastSendRef.current = { paperId, message, references, sessionId, providerId };
      pendingUserMessageRef.current = message;
      accumulatedContentRef.current = '';

      setState({
        ...INITIAL_STATE,
        status: 'connecting',
        content: '',
        displayedContent: '',
      });

      try {
        const gen = chatStreamClient.streamMessage(
          paperId,
          message,
          references,
          sessionId,
          { signal: controller.signal, timeoutMs: 60_000, maxRetries: 2, providerId },
        );

        for await (const event of gen) {
          if (controller.signal.aborted) break;

          setState((prev) => {
            const next = { ...prev };

            switch (event.type) {
              case 'chunk': {
                const text = event.content || '';
                accumulatedContentRef.current += text;
                next.content = prev.content + text;
                next.status = 'streaming';
                break;
              }

              case 'tool_call':
                next.toolCalls = [
                  ...prev.toolCalls,
                  {
                    tool: event.tool || 'unknown',
                    arguments: (event.arguments as Record<string, unknown>) || {},
                    timestamp: Date.now(),
                  },
                ];
                next.currentTool = event.tool || 'unknown';
                next.status = 'using_tool';
                break;

              case 'tool_result':
                next.toolResults = [
                  ...prev.toolResults,
                  {
                    tool: event.tool || 'unknown',
                    result: event.result || '',
                    timestamp: Date.now(),
                  },
                ];
                next.currentTool = null;
                if (prev.toolCalls.length > prev.toolResults.length) {
                  // Still more tools to run
                } else {
                  next.status = 'streaming';
                }
                break;

              case 'thought':
                next.thoughts = [
                  ...prev.thoughts,
                  {
                    content: event.content || '',
                    timestamp: Date.now(),
                  },
                ];
                next.status = 'thinking';
                break;

              case 'error':
                next.status = 'error';
                next.error = {
                  message: event.error || 'An error occurred',
                  code: (event.error_code as string) || 'internal',
                  recoverable: event.recoverable !== false,
                };
                break;

              case 'keepalive':
                // No state change — just keeps the connection alive
                break;

              case 'done':
                next.messageId = (event.message_id as number) ?? null;
                next.sessionId = (event.session_id as number) ?? null;
                next.status = 'done';
                break;
            }

            return next;
          });
        }

        // Stream ended without explicit 'done' — synthesize one
        setState((prev) => {
          if (prev.status !== 'done' && prev.status !== 'error') {
            return { ...prev, status: 'done' };
          }
          return prev;
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setState((prev) => ({
            ...prev,
            status: 'idle',
            error: null,
          }));
          return;
        }

        const message = (err as Error).message || 'Failed to send message';
        logger.error('Chat stream error:', err);

        setState((prev) => ({
          ...prev,
          status: 'error',
          error: {
            message,
            code: 'internal',
            recoverable: true,
          },
        }));
      } finally {
        pendingUserMessageRef.current = null;
      }
    },
    [],
  );

  const send = useCallback(
    (
      paperId: number,
      message: string,
      references?: ChatReferences,
      sessionId?: number,
      providerId?: number,
    ) => {
      void runStream(paperId, message, references, sessionId, providerId);
    },
    [runStream],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) => ({
      ...prev,
      status: 'idle',
      error: null,
    }));
    pendingUserMessageRef.current = null;
  }, []);

  const retry = useCallback(() => {
    const last = lastSendRef.current;
    if (!last) return;
    void runStream(
      last.paperId,
      last.message,
      last.references,
      last.sessionId,
      last.providerId,
    );
  }, [runStream]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL_STATE);
    pendingUserMessageRef.current = null;
    lastSendRef.current = null;
  }, []);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (displayTimerRef.current) clearInterval(displayTimerRef.current);
    };
  }, []);

  return {
    ...state,
    send,
    cancel,
    retry,
    reset,
    isActive:
      state.status === 'connecting' ||
      state.status === 'streaming' ||
      state.status === 'thinking' ||
      state.status === 'using_tool',
    pendingUserMessage: pendingUserMessageRef.current,
  };
}

export default useChatStream;
