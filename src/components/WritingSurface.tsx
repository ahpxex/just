import { Editor } from "./Editor";

interface WritingSurfaceProps {
  content: string;
  onChange: (content: string) => void;
}

export function WritingSurface({ content, onChange }: WritingSurfaceProps) {
  return (
    <div className="bg-paper h-full w-full">
      <Editor initialContent={content} onChange={onChange} />
    </div>
  );
}
