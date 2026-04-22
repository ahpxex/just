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

export const workspaceInit = () => invoke<string>("workspace_init");

export const listDocs = () => invoke<DocMeta[]>("list_docs");

export const readDoc = (path: string) => invoke<string>("read_doc", { path });

export const writeDoc = (path: string, content: string) =>
  invoke<DocMeta>("write_doc", { path, content });

export const createDoc = () => invoke<DocMeta>("create_doc");

export const readState = () => invoke<AppState>("read_state");

export const writeState = (state: AppState) =>
  invoke<void>("write_state", { state });
