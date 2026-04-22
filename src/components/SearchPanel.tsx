import {
  SearchQuery,
  findNext,
  findPrevious,
  setSearchQuery,
} from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

interface SearchPanelProps {
  view: EditorView | null;
  onClose: () => void;
}

export function SearchPanel({ view, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!view) return;
    view.dispatch({
      effects: setSearchQuery.of(new SearchQuery({ search: query })),
    });
    if (query) {
      findNext(view);
    }
  }, [query, view]);

  const handleClose = () => {
    if (view) {
      view.dispatch({
        effects: setSearchQuery.of(new SearchQuery({ search: "" })),
      });
    }
    onClose();
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!view || !query) return;
      if (e.shiftKey) findPrevious(view);
      else findNext(view);
    }
  };

  return (
    <div className="fixed top-[6vh] right-[6vw] z-20">
      <div className="bg-paper-deep/70 border-mist flex items-center gap-3 border-b px-4 py-2 backdrop-blur-md">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-ink placeholder-ink-faint w-64 border-0 bg-transparent text-base tracking-wide outline-none"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
