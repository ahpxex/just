const BLOCKED_MOD_KEYS = new Set(["r", "w", "h", "m"]);

export function installShortcutBlocker() {
  window.addEventListener(
    "keydown",
    (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod) {
        const key = e.key.toLowerCase();
        if (BLOCKED_MOD_KEYS.has(key)) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      }
      if (e.key === "F11") {
        e.preventDefault();
      }
    },
    { capture: true },
  );
}
