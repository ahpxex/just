import { useEffect, useState } from "react";
import { hotkeyBlockHealthy, openAccessibilitySettings } from "../workspace";

// Subtle top-left reminder that global launcher shortcuts can still
// escape `just` — shown only when the OS-level hotkey block failed to
// install (typically because macOS Accessibility permission is not
// granted yet). Clicking opens the relevant System Settings pane.
export function HotkeyBlockIndicator() {
  const [healthy, setHealthy] = useState(true);

  useEffect(() => {
    void hotkeyBlockHealthy().then(setHealthy);
  }, []);

  if (healthy) return null;

  return (
    <button
      type="button"
      onClick={() => void openAccessibilitySettings()}
      title="launchers like Spotlight and Raycast can escape just until accessibility is granted"
      className="text-ink-faint hover:text-ink fixed top-3 left-4 z-30 text-[10px] tracking-[0.3em] decoration-[1px] underline-offset-[0.35em] transition-colors hover:underline"
    >
      launchers unlocked
    </button>
  );
}
