import { useEffect, useReducer, useRef, useState } from "react";
import { formatNumber, formatRelativeTime } from "../words";

interface FooterRevealProps {
  wordCount: number;
  modifiedAt: number;
}

const DWELL_MS = 1200;
const BOTTOM_ZONE_PX = 48;
const RELATIVE_TICK_MS = 30000;

export function FooterReveal({ wordCount, modifiedAt }: FooterRevealProps) {
  const [visible, setVisible] = useState(false);
  const dwellTimer = useRef<number | null>(null);
  const [, tick] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const id = window.setInterval(() => tick(), RELATIVE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const nearBottom = e.clientY >= window.innerHeight - BOTTOM_ZONE_PX;
      if (nearBottom) {
        if (dwellTimer.current === null) {
          dwellTimer.current = window.setTimeout(() => {
            setVisible(true);
            dwellTimer.current = null;
          }, DWELL_MS);
        }
      } else {
        if (dwellTimer.current !== null) {
          window.clearTimeout(dwellTimer.current);
          dwellTimer.current = null;
        }
        setVisible(false);
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (dwellTimer.current !== null) {
        window.clearTimeout(dwellTimer.current);
      }
    };
  }, []);

  const label = wordCount === 1 ? "word" : "words";
  const rel = formatRelativeTime(modifiedAt);
  const text = rel
    ? `${formatNumber(wordCount)} ${label} · saved ${rel}`
    : `${formatNumber(wordCount)} ${label}`;

  return (
    <div
      className={`text-ink-faint pointer-events-none fixed bottom-4 left-1/2 z-10 -translate-x-1/2 text-xs tracking-[0.3em] transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {text}
    </div>
  );
}
