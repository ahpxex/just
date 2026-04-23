import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration, formatNumber } from "../words";

interface SessionDialogProps {
  words: number;
  keystrokes: number;
  totalWritingMs: number;
  sessionsCompleted: number;
  onLeave: () => void;
  onCopy: () => void;
  onContinue: () => void;
}

const COPIED_DWELL_MS = 700;

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-ink text-6xl leading-none font-light tracking-tight tabular-nums">
        {formatNumber(value)}
      </div>
      <div className="text-ink-faint text-[10px] tracking-[0.4em] uppercase">
        {label}
      </div>
    </div>
  );
}

export function SessionDialog({
  words,
  keystrokes,
  totalWritingMs,
  sessionsCompleted,
  onLeave,
  onCopy,
  onContinue,
}: SessionDialogProps) {
  const [justCopied, setJustCopied] = useState(false);
  const copiedRef = useRef(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const triggerCopy = useCallback(() => {
    if (copiedRef.current) return;
    copiedRef.current = true;
    setJustCopied(true);
    copyTimerRef.current = window.setTimeout(() => {
      copyTimerRef.current = null;
      onCopy();
    }, COPIED_DWELL_MS);
  }, [onCopy]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "l") {
        e.preventDefault();
        e.stopPropagation();
        onLeave();
      } else if (key === "c" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        triggerCopy();
      } else if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onContinue();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, [onLeave, onContinue, triggerCopy]);

  const wordsLabel = words === 1 ? "word" : "words";
  const keystrokesLabel = keystrokes === 1 ? "keystroke" : "keystrokes";
  const sessionsLine =
    sessionsCompleted === 1
      ? "first session on this piece"
      : `${formatNumber(sessionsCompleted)} sessions on this piece`;

  const actionClass =
    "hover:text-ink cursor-pointer transition-colors decoration-[1px] underline-offset-[0.4em] hover:underline";

  return (
    <div className="bg-paper/[0.98] fixed inset-0 z-40 overflow-auto backdrop-blur-md">
      <div className="flex min-h-full flex-col items-center justify-between px-10 py-[15vh]">
        <header className="ritual-in flex flex-col items-center gap-7">
          <div className="text-ink text-2xl font-light tracking-[0.45em]">
            42 minutes
          </div>
          <div className="bg-mist h-px w-10" />
        </header>

        <div
          className="ritual-in flex items-baseline gap-24"
          style={{ animationDelay: "220ms" }}
        >
          <Stat value={words} label={wordsLabel} />
          <Stat value={keystrokes} label={keystrokesLabel} />
        </div>

        <div
          className="ritual-in text-ink-faint text-xs tracking-[0.3em]"
          style={{ animationDelay: "440ms" }}
        >
          {formatDuration(totalWritingMs)} total · {sessionsLine}
        </div>

        <div
          className="ritual-in text-ink-soft flex gap-20 text-base tracking-[0.35em]"
          style={{ animationDelay: "660ms" }}
        >
          <button type="button" onClick={onLeave} className={actionClass}>
            leave
          </button>
          <button type="button" onClick={triggerCopy} className={actionClass}>
            {justCopied ? "copied" : "copy"}
          </button>
          <button type="button" onClick={onContinue} className={actionClass}>
            continue
          </button>
        </div>
      </div>
    </div>
  );
}
