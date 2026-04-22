import { atom } from "jotai";
import type { DocMeta } from "./workspace";

export const workspacePathAtom = atom<string | null>(null);

export const currentDocAtom = atom<DocMeta | null>(null);

export const currentContentAtom = atom<string>("");

export const documentsAtom = atom<DocMeta[]>([]);

export type Mode = "writing" | "drawer";
export const modeAtom = atom<Mode>("writing");
