import { invoke } from "@tauri-apps/api/core";

export interface DocMeta {
  path: string;
  title: string;
  excerpt: string;
  wordCount: number;
  modifiedAt: number;
}

export interface AppState {
  currentDoc: string | null;
}

export interface DocStats {
  totalWritingMs: number;
  totalKeystrokes: number;
  sessionsCompleted: number;
}

export const workspaceInit = () => invoke<string>("workspace_init");

export const listDocs = () => invoke<DocMeta[]>("list_docs");

export const readDoc = (path: string) => invoke<string>("read_doc", { path });

export const writeDoc = (path: string, content: string) =>
  invoke<DocMeta>("write_doc", { path, content });

export const createDoc = () => invoke<DocMeta>("create_doc");

export const deleteDoc = (path: string) =>
  invoke<string>("delete_doc", { path });

export const restoreDoc = (trashPath: string) =>
  invoke<DocMeta>("restore_doc", { trashPath });

export const readState = () => invoke<AppState>("read_state");

export const writeState = (state: AppState) =>
  invoke<void>("write_state", { state });

export const readDocStats = (path: string) =>
  invoke<DocStats>("read_doc_stats", { path });

export const recordSession = (
  path: string,
  writingMs: number,
  keystrokes: number,
  completed: boolean,
) =>
  invoke<DocStats>("record_session", {
    path,
    writingMs,
    keystrokes,
    completed,
  });

export const requestExit = () => invoke<void>("request_exit");

export const savePastedImage = (
  docPath: string,
  bytes: number[],
  extension: string,
) =>
  invoke<string>("save_pasted_image", {
    docPath,
    bytes,
    extension,
  });
