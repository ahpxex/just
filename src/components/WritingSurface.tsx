import { Editor } from "./Editor";

interface WritingSurfaceProps {
  content: string;
  onChange: (content: string) => void;
  active: boolean;
}

export function WritingSurface({
  content,
  onChange,
  active,
}: WritingSurfaceProps) {
  return (
    <div className="bg-paper h-full w-full">
      <Editor initialContent={content} onChange={onChange} active={active} />
    </div>
  );
}
