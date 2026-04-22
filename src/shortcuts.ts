import { devForceQuit } from "./workspace";

const BLOCKED_MOD_KEYS = new Set(["r", "w", "h", "m"]);

export function installShortcutBlocker() {
  window.addEventListener(
    "keydown",
    (e) => {
      // DEV-only escape hatch so the developer can exit the locked app.
      if (
        import.meta.env.DEV &&
        (e.metaKey || e.ctrlKey) &&
        e.altKey &&
        e.key.toLowerCase() === "q"
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void devForceQuit();
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (mod) {
        const key = e.key.toLowerCase();
        if (BLOCKED_MOD_KEYS.has(key)) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      }

      // Alt+F4 on Windows: prevent_close also catches the CloseRequested,
      // this is defense in depth.
      if (e.altKey && e.key === "F4") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }

      if (e.key === "F11") {
        e.preventDefault();
      }
    },
    { capture: true },
  );
}
