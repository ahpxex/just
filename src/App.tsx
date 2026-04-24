import { useAtom, useSetAtom } from "jotai";
import type { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDoc,
  deleteDoc,
  listDocs,
  readDoc,
  readState,
  recordSession,
  requestExit,
  restoreDoc,
  writeDoc,
  writeState,
  workspaceInit,
} from "./workspace";
import {
  currentContentAtom,
  currentDocAtom,
  documentsAtom,
  modeAtom,
  workspacePathAtom,
} from "./atoms";
import { Drawer } from "./components/Drawer";
import { FooterReveal } from "./components/FooterReveal";
import { SearchPanel } from "./components/SearchPanel";
import { SessionDialog } from "./components/SessionDialog";
import { WritingSurface } from "./components/WritingSurface";
import { type SessionSnapshot, useSessionTracker } from "./session";
import { wordCount } from "./words";

const SAVE_DEBOUNCE_MS = 600;
const SESSION_LENGTH_MS = (() => {
  if (import.meta.env.DEV) {
    const override = Number(import.meta.env.VITE_SESSION_SECONDS);
    if (Number.isFinite(override) && override > 0) return override * 1000;
  }
  return 42 * 60 * 1000;
})();

interface SessionDialogData {
  words: number;
  keystrokes: number;
  totalWritingMs: number;
  sessionsCompleted: number;
}

function App() {
  const setWorkspacePath = useSetAtom(workspacePathAtom);
  const [currentDoc, setCurrentDoc] = useAtom(currentDocAtom);
  const [content, setContent] = useAtom(currentContentAtom);
  const setDocuments = useSetAtom(documentsAtom);
  const [mode, setMode] = useAtom(modeAtom);
  const [ready, setReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dialogData, setDialogData] = useState<SessionDialogData | null>(null);
  const [postSessionGrace, setPostSessionGrace] = useState(false);

  const initRef = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const pendingSave = useRef<{ path: string; content: string } | null>(null);
  const modeRef = useRef(mode);
  const currentPathRef = useRef<string | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const contentRef = useRef(content);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    currentPathRef.current = currentDoc?.path ?? null;
  }, [currentDoc]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const handleViewReady = useCallback((view: EditorView | null) => {
    editorViewRef.current = view;
  }, []);

  const flushSave = useCallback(async () => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingSave.current) {
      const { path, content } = pendingSave.current;
      pendingSave.current = null;
      const meta = await writeDoc(path, content);
      setCurrentDoc(meta);
    }
  }, [setCurrentDoc]);

  const handleSessionComplete = useCallback(
    async (snapshot: SessionSnapshot) => {
      if (!snapshot.docPath) return;
      await flushSave();
      const stats = await recordSession(
        snapshot.docPath,
        snapshot.activeMs,
        snapshot.keystrokes,
        true,
      );
      setDialogData({
        words: wordCount(contentRef.current),
        keystrokes: snapshot.keystrokes,
        totalWritingMs: stats.totalWritingMs,
        sessionsCompleted: stats.sessionsCompleted,
      });
    },
    [flushSave],
  );

  const handleSessionStart = useCallback(() => {
    setPostSessionGrace(false);
  }, []);

  const { resetSession } = useSessionTracker({
    docPath: currentDoc?.path ?? null,
    sessionLengthMs: SESSION_LENGTH_MS,
    onComplete: handleSessionComplete,
    onStart: handleSessionStart,
  });

  const openDocument = useCallback(
    async (path: string) => {
      await flushSave();
      const [text, docs] = await Promise.all([readDoc(path), listDocs()]);
      const doc = docs.find((d) => d.path === path);
      if (!doc) return;
      setContent(text);
      setCurrentDoc(doc);
      setDocuments(docs);
      await writeState({ currentDoc: path });
      setMode("writing");
    },
    [flushSave, setContent, setCurrentDoc, setDocuments, setMode],
  );

  const createNewDocument = useCallback(async () => {
    await flushSave();
    const doc = await createDoc();
    setContent("");
    setCurrentDoc(doc);
    setDocuments(await listDocs());
    await writeState({ currentDoc: doc.path });
    setMode("writing");
  }, [flushSave, setContent, setCurrentDoc, setDocuments, setMode]);

  const toggleDrawer = useCallback(async () => {
    if (modeRef.current === "writing") {
      await flushSave();
      setDocuments(await listDocs());
      setMode("drawer");
    } else {
      setMode("writing");
    }
  }, [flushSave, setDocuments, setMode]);

  const handleDelete = useCallback(
    async (path: string): Promise<string> => {
      if (currentPathRef.current === path) {
        if (saveTimer.current !== null) {
          window.clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        pendingSave.current = null;
      } else {
        await flushSave();
      }
      const trashPath = await deleteDoc(path);
      let docs = await listDocs();

      if (currentPathRef.current === path) {
        if (docs.length > 0) {
          const next = docs[0];
          const text = await readDoc(next.path);
          setContent(text);
          setCurrentDoc(next);
          await writeState({ currentDoc: next.path });
        } else {
          const newDoc = await createDoc();
          setContent("");
          setCurrentDoc(newDoc);
          await writeState({ currentDoc: newDoc.path });
          docs = await listDocs();
        }
      }
      setDocuments(docs);
      return trashPath;
    },
    [flushSave, setContent, setCurrentDoc, setDocuments],
  );

  const handleRestore = useCallback(
    async (trashPath: string) => {
      await restoreDoc(trashPath);
      setDocuments(await listDocs());
    },
    [setDocuments],
  );

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      const path = await workspaceInit();
      setWorkspacePath(path);

      const state = await readState();
      const docs = await listDocs();
      setDocuments(docs);

      let doc = state.currentDoc
        ? (docs.find((d) => d.path === state.currentDoc) ?? null)
        : null;
      let text = "";
      if (doc) {
        try {
          text = await readDoc(doc.path);
        } catch {
          doc = null;
          text = "";
        }
      }
      if (!doc) {
        doc = await createDoc();
        await writeState({ currentDoc: doc.path });
        setDocuments(await listDocs());
      }

      setContent(text);
      setCurrentDoc(doc);
      setReady(true);
    })();
  }, [setContent, setCurrentDoc, setDocuments, setWorkspacePath]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "n" && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void createNewDocument();
      } else if (key === "k" && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void toggleDrawer();
      } else if (key === "f" && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (modeRef.current === "writing") {
          setSearchOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, [createNewDocument, toggleDrawer]);

  const handleChange = useCallback(
    (next: string) => {
      setContent(next);
      if (!currentDoc) return;
      const path = currentDoc.path;
      pendingSave.current = { path, content: next };
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
      }
      saveTimer.current = window.setTimeout(() => {
        const pending = pendingSave.current;
        pendingSave.current = null;
        saveTimer.current = null;
        if (pending) {
          void writeDoc(pending.path, pending.content).then(setCurrentDoc);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [currentDoc, setContent, setCurrentDoc],
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    editorViewRef.current?.focus();
  }, []);

  const handleDialogLeave = useCallback(async () => {
    await flushSave();
    await requestExit();
  }, [flushSave]);

  const handleDialogCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(contentRef.current);
    } catch {
      // Some environments block clipboard writes; fail silently in Zen spirit.
    }
    setDialogData(null);
    resetSession();
    setPostSessionGrace(true);
  }, [resetSession]);

  const handleDialogContinue = useCallback(() => {
    setDialogData(null);
    resetSession();
    setPostSessionGrace(true);
  }, [resetSession]);

  const liveWordCount = useMemo(() => wordCount(content), [content]);

  if (!ready || !currentDoc) {
    return <main className="bg-paper h-full w-full" />;
  }

  return (
    <main className="h-full w-full">
      <WritingSurface
        content={content}
        onChange={handleChange}
        active={mode === "writing" && !searchOpen && dialogData === null}
        docPath={currentDoc.path}
        onViewReady={handleViewReady}
      />
      {mode === "writing" && dialogData === null && !searchOpen && (
        <FooterReveal
          wordCount={liveWordCount}
          modifiedAt={currentDoc.modifiedAt}
        />
      )}
      {searchOpen && mode === "writing" && dialogData === null && (
        <SearchPanel view={editorViewRef.current} onClose={closeSearch} />
      )}
      {mode === "drawer" && dialogData === null && (
        <Drawer
          onOpen={openDocument}
          onClose={() => setMode("writing")}
          onDelete={handleDelete}
          onRestore={handleRestore}
        />
      )}
      {dialogData && (
        <SessionDialog
          words={dialogData.words}
          keystrokes={dialogData.keystrokes}
          totalWritingMs={dialogData.totalWritingMs}
          sessionsCompleted={dialogData.sessionsCompleted}
          onLeave={handleDialogLeave}
          onCopy={handleDialogCopy}
          onContinue={handleDialogContinue}
        />
      )}
      {postSessionGrace &&
        dialogData === null &&
        mode === "writing" &&
        !searchOpen && (
          <button
            type="button"
            onClick={handleDialogLeave}
            className="text-ink-faint hover:text-ink ritual-in fixed top-6 right-8 z-30 text-xs tracking-[0.4em] decoration-[1px] underline-offset-[0.35em] transition-colors hover:underline"
          >
            leave
          </button>
        )}
      {import.meta.env.DEV && (
        <button
          type="button"
          onClick={() => void requestExit()}
          title="dev: force quit"
          className="bg-ink-faint/30 hover:bg-ink-soft fixed top-2 right-2 z-50 h-2 w-2 rounded-full transition-colors"
        />
      )}
    </main>
  );
}

export default App;
