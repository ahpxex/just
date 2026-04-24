# just

A writing app with one idea: you only write.

No tabs. No sidebar. No settings. No sync. No plugins. No AI.
Open it and the window fills the screen. It will not let you
leave until you've sat with the page for forty-two minutes.

Everything you write lives as plain `.md` files on your disk.
You can open them in any editor. You can back them up with
Time Machine or Dropbox. You can forget `just` exists tomorrow
and still have every word.

![just](src-tauri/icons/icon.png)

---

## The covenant

Installing `just` means signing a small pact.

The window enters fullscreen on launch and cannot be closed.
`Cmd+Q`, `Alt+F4`, the close button, the Dock's right-click
Quit, system launchers like Spotlight and Raycast — all
neutralized while `just` holds focus. Force-quit remains
available. That is the operating system's last-resort guarantee
and `just` respects it.

Every 42 minutes of active writing, a ritual dialog opens. It
shows what you did — word count, keystrokes, cumulative time
on this piece — and offers three honest ways forward:

> **leave.** The only sanctioned exit.
>
> **copy.** Put the draft on the clipboard; the session ends.
>
> **continue.** Close the dialog and begin another 42 minutes.

Between dismissing the dialog and your next keystroke, a quiet
*leave* waits in the top-right corner. The moment you type, it
vanishes. You are committed to another turn.

---

## Why

Writing software has drifted into writing *environment* — tabs,
outlines, plugin shelves, notification badges, focus modes that
paint over the distractions instead of removing them. `just`
takes the opposite posture: remove everything, including the
exit.

The forty-two-minute lock is not gamification. It is a
dignified unit of uninterrupted concentration. Commit to it
once, and the work that was waiting to happen begins to happen.

Your writing is never held hostage. The files are always yours,
in plain Markdown, on your disk, today and ten years from now.

---

## More

- [`AGENTS.md`](AGENTS.md) — the full product contract. Every
  feature that exists, every feature that never will, and the
  single question asked of any new proposal: *does the writing
  die without it?*
- [`DEVELOPING.md`](DEVELOPING.md) — for people who want to
  build from source, sign, or cut a release.
