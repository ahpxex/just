import { useEffect, useState } from "react";
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
        setJustCopied(true);
        onCopy();
      } else if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onContinue();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, [onLeave, onCopy, onContinue]);

  const wordsLabel = words === 1 ? "word" : "words";
  const keystrokesLabel = keystrokes === 1 ? "keystroke" : "keystrokes";
  const sessionsLine =
    sessionsCompleted === 1
      ? "first session on this piece"
      : `${formatNumber(sessionsCompleted)} sessions on this piece`;

  const actionClass =
    "hover:text-ink cursor-pointer transition-colors decoration-[1px] underline-offset-[0.35em] hover:underline";

  return (
    <div className="bg-paper/98 fixed inset-0 z-40 flex items-center justify-center backdrop-blur-md">
      <div className="flex min-w-[320px] flex-col items-center gap-10 text-center">
        <div className="text-ink text-xl tracking-[0.35em]">42 minutes</div>

        <div className="text-ink flex flex-col gap-1 text-base">
          <div>
            {formatNumber(words)} {wordsLabel}
          </div>
          <div>
            {formatNumber(keystrokes)} {keystrokesLabel}
          </div>
        </div>

        <div className="text-ink-soft text-sm tracking-wider">
          {formatDuration(totalWritingMs)} total · {sessionsLine}
        </div>

        <div className="text-ink-soft flex flex-col gap-3 text-base tracking-widest">
          <button type="button" onClick={onLeave} className={actionClass}>
            leave
          </button>
          <button
            type="button"
            onClick={() => {
              setJustCopied(true);
              onCopy();
            }}
            className={actionClass}
          >
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
