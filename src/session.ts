import { useCallback, useEffect, useRef } from "react";
import { recordSession } from "./workspace";

export interface SessionSnapshot {
  docPath: string | null;
  startTime: number | null;
  activeMs: number;
  keystrokes: number;
}

interface UseSessionTrackerOptions {
  docPath: string | null;
  sessionLengthMs: number;
  idleThresholdMs?: number;
  tickMs?: number;
  onComplete: (snapshot: SessionSnapshot) => void;
  onStart?: () => void;
}

const MODIFIER_ONLY_KEYS = new Set([
  "Shift",
  "Control",
  "Meta",
  "Alt",
  "CapsLock",
  "AltGraph",
  "Fn",
  "FnLock",
  "NumLock",
  "ScrollLock",
]);

const NAVIGATION_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Escape",
]);

const WRITING_COMMAND_KEYS = new Set(["v", "x", "z", "y"]);

function isWritingKey(e: KeyboardEvent): boolean {
  if (MODIFIER_ONLY_KEYS.has(e.key)) return false;
  if (NAVIGATION_KEYS.has(e.key)) return false;
  if (/^F\d+$/.test(e.key)) return false;
  if (e.metaKey || e.ctrlKey) {
    return WRITING_COMMAND_KEYS.has(e.key.toLowerCase());
  }
  return true;
}

function isEditorFocused(): boolean {
  const active = document.activeElement;
  return !!active && active.closest(".cm-editor") !== null;
}

function emptySession(docPath: string | null): SessionSnapshot {
  return {
    docPath,
    startTime: null,
    activeMs: 0,
    keystrokes: 0,
  };
}

export function useSessionTracker({
  docPath,
  sessionLengthMs,
  idleThresholdMs = 2 * 60 * 1000,
  tickMs = 5000,
  onComplete,
  onStart,
}: UseSessionTrackerOptions) {
  const sessionRef = useRef<SessionSnapshot>(emptySession(null));
  const lastActivityRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onStartRef = useRef(onStart);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onStartRef.current = onStart;
  }, [onStart]);

  // Doc switch: commit any in-progress session of the prior doc, then reset.
  useEffect(() => {
    const prior = sessionRef.current;
    if (
      prior.docPath &&
      prior.docPath !== docPath &&
      prior.keystrokes > 0
    ) {
      void recordSession(
        prior.docPath,
        prior.activeMs,
        prior.keystrokes,
        false,
      );
    }
    sessionRef.current = emptySession(docPath);
    lastActivityRef.current = null;
    completedRef.current = false;
  }, [docPath]);

  // Only count keystrokes that are plausibly "writing" and only when focus is
  // inside the CodeMirror editor. Drawer search, search panel input, and
  // command shortcuts (Cmd+K, Cmd+N, Cmd+F) do not open a session.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isWritingKey(e)) return;
      if (!isEditorFocused()) return;
      const now = Date.now();
      const s = sessionRef.current;
      if (s.docPath === null) return;
      const isFirstKey = s.startTime === null;
      if (isFirstKey) {
        s.startTime = now;
      }
      s.keystrokes += 1;
      lastActivityRef.current = now;
      if (isFirstKey) {
        onStartRef.current?.();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, []);

  // Tick: if user is still within idle threshold, credit tickMs to activeMs.
  // If total active exceeds sessionLengthMs, fire the completion callback once.
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = sessionRef.current;
      if (s.startTime === null || lastActivityRef.current === null) return;
      const now = Date.now();
      const idleFor = now - lastActivityRef.current;
      if (idleFor < idleThresholdMs) {
        s.activeMs += tickMs;
      }
      if (!completedRef.current && s.activeMs >= sessionLengthMs) {
        completedRef.current = true;
        onCompleteRef.current({ ...s });
      }
    }, tickMs);
    return () => window.clearInterval(id);
  }, [idleThresholdMs, sessionLengthMs, tickMs]);

  const resetSession = useCallback(() => {
    sessionRef.current = emptySession(sessionRef.current.docPath);
    lastActivityRef.current = null;
    completedRef.current = false;
  }, []);

  const getSnapshot = useCallback(
    (): SessionSnapshot => ({ ...sessionRef.current }),
    [],
  );

  const commitAndReset = useCallback(async (completed: boolean) => {
    const s = sessionRef.current;
    if (s.docPath && s.keystrokes > 0) {
      await recordSession(s.docPath, s.activeMs, s.keystrokes, completed);
    }
    sessionRef.current = emptySession(s.docPath);
    lastActivityRef.current = null;
    completedRef.current = false;
  }, []);

  return { resetSession, getSnapshot, commitAndReset };
}
