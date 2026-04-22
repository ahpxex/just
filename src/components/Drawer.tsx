import { useAtomValue } from "jotai";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { documentsAtom } from "../atoms";

interface DrawerProps {
  onOpen: (path: string) => void;
  onClose: () => void;
  onDelete: (path: string) => Promise<string>;
  onRestore: (trashPath: string) => Promise<void>;
}

const RESTORE_WINDOW_MS = 5000;

export function Drawer({ onOpen, onClose, onDelete, onRestore }: DrawerProps) {
  const documents = useAtomValue(documentsAtom);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(0);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLLIElement>(null);

  const filtered = filter.trim()
    ? documents.filter((d) =>
        (d.title + " " + d.excerpt)
          .toLowerCase()
          .includes(filter.toLowerCase()),
      )
    : documents;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (selected >= filtered.length) {
      setSelected(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selected]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  useEffect(() => {
    if (!pendingRestore) return;
    const t = window.setTimeout(
      () => setPendingRestore(null),
      RESTORE_WINDOW_MS,
    );
    return () => window.clearTimeout(t);
  }, [pendingRestore]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === "z" &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      pendingRestore
    ) {
      e.preventDefault();
      const trashPath = pendingRestore;
      setPendingRestore(null);
      void onRestore(trashPath);
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
      e.preventDefault();
      const doc = filtered[selected];
      if (doc) {
        void onDelete(doc.path).then((trashPath) => {
          setPendingRestore(trashPath);
        });
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const doc = filtered[selected];
      if (doc) onOpen(doc.path);
    }
  };

  return (
    <div
      className="bg-paper/95 fixed inset-0 z-10 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-auto h-full max-w-[680px] overflow-auto px-8 py-[14vh]">
        <input
          ref={inputRef}
          type="text"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setSelected(0);
          }}
          onKeyDown={handleKeyDown}
          className="border-mist text-ink placeholder-ink-faint mb-8 w-full border-0 border-b bg-transparent pb-3 text-lg tracking-wider outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        {filtered.length === 0 ? (
          <div className="text-ink-faint text-sm tracking-widest">无</div>
        ) : (
          <ul>
            {filtered.map((doc, i) => (
              <li
                key={doc.path}
                ref={i === selected ? selectedRef : null}
                onClick={() => onOpen(doc.path)}
                className={`cursor-pointer py-4 transition-colors ${
                  i === selected
                    ? "text-ink"
                    : "text-ink-faint hover:text-ink-soft"
                }`}
              >
                <div className="text-base">{doc.title || "未命名"}</div>
                {doc.excerpt && (
                  <div className="text-ink-faint mt-1 text-sm">
                    {doc.excerpt}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {pendingRestore && (
        <div className="text-ink-faint pointer-events-none fixed bottom-[8vh] left-1/2 -translate-x-1/2 text-sm tracking-widest">
          已收走 · 按 Z 追回
        </div>
      )}
    </div>
  );
}
