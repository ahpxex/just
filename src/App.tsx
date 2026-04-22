import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDoc,
  listDocs,
  readDoc,
  readState,
  writeDoc,
  writeState,
  workspaceInit,
} from "./workspace";
import {
  currentContentAtom,
  currentDocAtom,
  documentsAtom,
  workspacePathAtom,
} from "./atoms";
import { WritingSurface } from "./components/WritingSurface";

const SAVE_DEBOUNCE_MS = 600;

function App() {
  const setWorkspacePath = useSetAtom(workspacePathAtom);
  const [currentDoc, setCurrentDoc] = useAtom(currentDocAtom);
  const [content, setContent] = useAtom(currentContentAtom);
  const setDocuments = useSetAtom(documentsAtom);
  const [ready, setReady] = useState(false);
  const initRef = useRef(false);
  const saveTimer = useRef<number | null>(null);

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

  const handleChange = useCallback(
    (next: string) => {
      setContent(next);
      if (!currentDoc) return;
      const path = currentDoc.path;
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
      }
      saveTimer.current = window.setTimeout(async () => {
        const meta = await writeDoc(path, next);
        setCurrentDoc(meta);
      }, SAVE_DEBOUNCE_MS);
    },
    [currentDoc, setContent, setCurrentDoc],
  );

  if (!ready || !currentDoc) {
    return <main className="bg-paper h-full w-full" />;
  }

  return (
    <main className="h-full w-full">
      <WritingSurface content={content} onChange={handleChange} />
    </main>
  );
}

export default App;
