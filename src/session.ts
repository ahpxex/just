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
}: UseSessionTrackerOptions) {
  const sessionRef = useRef<SessionSnapshot>(emptySession(null));
  const lastActivityRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

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

  // Count any non-modifier keydown as a keystroke; first keystroke opens the
  // session clock. The actual active-time accrual is done on the 5s tick.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (MODIFIER_ONLY_KEYS.has(e.key)) return;
      const now = Date.now();
      const s = sessionRef.current;
      if (s.docPath === null) return;
      if (s.startTime === null) {
        s.startTime = now;
      }
      s.keystrokes += 1;
      lastActivityRef.current = now;
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
