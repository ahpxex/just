import type { EditorView } from "@codemirror/view";
import { Editor } from "./Editor";

interface WritingSurfaceProps {
  content: string;
  onChange: (content: string) => void;
  active: boolean;
  onViewReady?: (view: EditorView | null) => void;
}

export function WritingSurface({
  content,
  onChange,
  active,
  onViewReady,
}: WritingSurfaceProps) {
  return (
    <div className="bg-paper h-full w-full">
      <Editor
        initialContent={content}
        onChange={onChange}
        active={active}
        onViewReady={onViewReady}
      />
    </div>
  );
}
