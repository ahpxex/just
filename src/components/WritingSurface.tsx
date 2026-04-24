import type { EditorView } from "@codemirror/view";
import { Editor } from "./Editor";

interface WritingSurfaceProps {
  content: string;
  onChange: (content: string) => void;
  active: boolean;
  docPath: string | null;
  onViewReady?: (view: EditorView | null) => void;
}

export function WritingSurface({
  content,
  onChange,
  active,
  docPath,
  onViewReady,
}: WritingSurfaceProps) {
  return (
    <div className="bg-paper h-full w-full">
      <Editor
        initialContent={content}
        onChange={onChange}
        active={active}
        docPath={docPath}
        onViewReady={onViewReady}
      />
    </div>
  );
}
