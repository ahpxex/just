import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  HighlightStyle,
  bracketMatching,
  syntaxHighlighting,
} from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { searchKeymap } from "@codemirror/search";
import { tags } from "@lezer/highlight";

interface EditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  active?: boolean;
}

const zenHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.55em", fontWeight: "500" },
  { tag: tags.heading2, fontSize: "1.32em", fontWeight: "500" },
  { tag: tags.heading3, fontSize: "1.15em", fontWeight: "500" },
  { tag: tags.heading4, fontWeight: "500" },
  { tag: tags.heading5, fontWeight: "500" },
  { tag: tags.heading6, fontWeight: "500" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.link, color: "var(--color-ink-soft)" },
  { tag: tags.quote, color: "var(--color-ink-soft)", fontStyle: "italic" },
  {
    tag: tags.monospace,
    fontFamily: "var(--font-mono)",
  },
  {
    tag: [tags.meta, tags.processingInstruction, tags.punctuation],
    color: "var(--color-ink-faint)",
  },
  { tag: tags.list, color: "var(--color-ink-soft)" },
]);

const zenTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "17px",
    color: "var(--color-ink)",
    backgroundColor: "transparent",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--font-serif)",
    lineHeight: "2",
  },
  ".cm-content": {
    padding: "14vh 0",
    maxWidth: "680px",
    margin: "0 auto",
    caretColor: "var(--color-ink-soft)",
    minHeight: "100%",
    boxSizing: "border-box",
  },
  ".cm-line": { padding: "0 24px" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--color-ink-soft)",
    borderLeftWidth: "1px",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "var(--color-paper-deep) !important",
  },
});

export function Editor({ initialContent, onChange, active }: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        history(),
        drawSelection(),
        EditorView.lineWrapping,
        bracketMatching(),
        markdown(),
        syntaxHighlighting(zenHighlight),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        zenTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Intentionally mount once. External content updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== initialContent) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: initialContent },
      });
    }
  }, [initialContent]);

  useEffect(() => {
    if (active && viewRef.current) {
      viewRef.current.focus();
    }
  }, [active]);

  return <div ref={hostRef} className="h-full w-full" />;
}
