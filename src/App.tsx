import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDoc,
  deleteDoc,
  listDocs,
  readDoc,
  readState,
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
import { WritingSurface } from "./components/WritingSurface";

const SAVE_DEBOUNCE_MS = 600;

function App() {
  const setWorkspacePath = useSetAtom(workspacePathAtom);
  const [currentDoc, setCurrentDoc] = useAtom(currentDocAtom);
  const [content, setContent] = useAtom(currentContentAtom);
  const setDocuments = useSetAtom(documentsAtom);
  const [mode, setMode] = useAtom(modeAtom);
  const [ready, setReady] = useState(false);

  const initRef = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const pendingSave = useRef<{ path: string; content: string } | null>(null);
  const modeRef = useRef(mode);
  const currentPathRef = useRef<string | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    currentPathRef.current = currentDoc?.path ?? null;
  }, [currentDoc]);

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
      if (key === "n") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void createNewDocument();
      } else if (key === "k") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void toggleDrawer();
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

  if (!ready || !currentDoc) {
    return <main className="bg-paper h-full w-full" />;
  }

  return (
    <main className="h-full w-full">
      <WritingSurface
        content={content}
        onChange={handleChange}
        active={mode === "writing"}
      />
      {mode === "drawer" && (
        <Drawer
          onOpen={openDocument}
          onClose={() => setMode("writing")}
          onDelete={handleDelete}
          onRestore={handleRestore}
        />
      )}
    </main>
  );
}

export default App;
