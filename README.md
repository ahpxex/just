# just

A writing app with one idea: you only write.

No tabs, no sidebar, no settings panel, no sync, no plugins, no AI. When
you open it, the window fills the screen and will not let you leave until
you've sat with the page for 42 minutes.

Built with Tauri 2, React 19, CodeMirror 6. Stores everything as plain
`.md` files on your disk. Reads like ink on paper.

![just](src-tauri/icons/icon.png)

---

## The covenant

Installing `just` means signing a small pact:

- The window enters fullscreen on launch and cannot be closed.
- `Cmd+Q`, `Alt+F4`, `Cmd+W`, `Cmd+H`, `Cmd+M`, the close button, the
  Dock's right-click Quit — all neutralized.
- `Cmd+Tab` / `Alt+Tab` and system launchers (Spotlight, Raycast,
  Alfred) are swallowed while `just` holds focus, so you can't slip
  out of writing mode.
- Every 42 minutes of active writing, a ritual dialog offers three
  honest ways out: **leave** (the only sanctioned exit), **copy** the
  draft to your clipboard, or **continue** for another turn.
- Between a dialog's dismissal and your next keystroke, a discreet
  `leave` button waits in the top-right corner. The moment you type, it
  vanishes; you're committed to another session.
- Force-quit (`Cmd+Option+Esc` on macOS, Task Manager on Windows, the
  power button) remains available. Those are the operating system's
  last-resort guarantees, and `just` respects them.

Your writing is never hostage. Every document is a plain-text `.md`
file at `~/Documents/just/`, which you can open in any editor at any
time — even if you never launch `just` again.

---

## Where things live

```
~/Documents/just/
├── 2026-04-22-153412.md    # each piece, named by creation time
├── 2026-04-23-091205.md
├── ...
└── .just/
    ├── state.json          # "last document you had open"
    ├── stats.json          # per-doc writing time and keystrokes
    ├── media/              # pasted images, one folder per doc
    │   └── 2026-04-22-153412/
    │       └── 2026-04-22-153412-221-043.png
    └── trash/              # deleted drafts, swept after 30 days
```

To change where the workspace lives, move the folder and symlink it
back to `~/Documents/just/`. There is no UI for this. There never will
be.

---

## Keyboard

Only a handful of shortcuts. Everything else is typing.

| key | effect |
|---|---|
| `Cmd+N` / `Ctrl+N` | new document |
| `Cmd+K` / `Ctrl+K` | open the drawer of drafts |
| `Cmd+F` / `Ctrl+F` | find within the current document |
| `Cmd+Z` / `Ctrl+Z` | undo, and all the usual text editing |
| (type anything) | filter the drawer once it's open |
| `↑` `↓` | navigate the drawer |
| `Enter` | open the selected draft |
| `Cmd+Backspace` in drawer | discard the selected draft |
| `Z` (within 5s) | restore what you just discarded |
| `Esc` | close the drawer or search |

In the 42-minute ritual dialog:

| key | effect |
|---|---|
| `L` | leave — save and exit |
| `C` | copy the current draft to clipboard |
| `Enter` / `Space` / `Esc` | continue — begin another 42 minutes |

---

## Install

Prebuilt binaries aren't shipped yet. Build from source.

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Bun](https://bun.sh)
- Platform toolchain:
  - macOS: Xcode command-line tools
  - Windows: Visual Studio Build Tools (C++ workload)
  - Linux: `webkit2gtk-4.1-dev` and friends (see Tauri docs)

### Run in development

```sh
bun install
bun run tauri dev
```

### Produce a release bundle

```sh
bun run tauri build
```

The bundle lands in `src-tauri/target/release/bundle/`. The binary
opens, but macOS Gatekeeper flags it as "unidentified developer"
until it is signed and notarized.

---

## Signing and distribution

### macOS

A signed and notarized `.app` opens with a double-click on any Mac.
An unsigned one requires right-click → Open on first launch and will
be rejected on some managed machines outright.

The signing identity and notarization credentials are never checked
into the repo. Export them as environment variables before building;
the Tauri CLI picks them up automatically.

```sh
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"   # from appleid.apple.com
export APPLE_TEAM_ID="TEAMID"

bun run tauri build
```

A thin wrapper is provided at `scripts/release.sh` that sanity-checks
these variables are set and then runs the build.

First-time setup:

1. Join the Apple Developer Program ($99/year) and create a
   *Developer ID Application* certificate in Xcode (*Settings →
   Accounts → Manage Certificates*). The identity string appears in
   Keychain Access.
2. Generate an app-specific password at
   https://appleid.apple.com → Sign-In and Security → App-Specific
   Passwords. Use this for `APPLE_PASSWORD`, not your Apple ID login.
3. Your `APPLE_TEAM_ID` is on https://developer.apple.com → Account →
   Membership.

### Windows

Code signing requires a certificate from a Microsoft-trusted CA. The
EV variant ($300+/year) is the one that clears SmartScreen warnings
on first download. Configure `bundle.windows.certificateThumbprint`
in `src-tauri/tauri.conf.json`, or set
`TAURI_BUNDLE_WINDOWS_CERTIFICATE_THUMBPRINT` in the environment.

Unsigned Windows builds run fine for internal use; end users see a
SmartScreen warning and have to click *More info → Run anyway*.

### Distribution

`just` bundles macOS and Windows installers but ships no
auto-updater — the app makes no outbound network requests by design
(see `AGENTS.md`). Pick one of:

- **GitHub Releases**: attach the artifacts from `target/release/bundle`
  manually, tag each release. Users download and install.
- **Homebrew Cask** (macOS): publish the signed `.dmg` to GitHub
  Releases and submit a cask formula pointing at the release URL.
- **Direct download** from a static site.

---

## First launch on macOS

`just` asks for **Accessibility** permission once, so it can swallow
global launcher shortcuts. A system dialog appears the first time you
run the app. Grant it in *System Settings → Privacy & Security →
Accessibility* and relaunch. Without the grant, `just` still runs, but
Raycast / Spotlight / Alfred can escape focus.

---

## Platform notes

- **macOS**: fully supported. Tested on Apple Silicon.
- **Windows**: the hotkey blocker (`WH_KEYBOARD_LL`) is implemented but
  not yet field-tested on a real Windows machine. The writing surface
  and all file operations work.
- **Linux**: the app runs, but **the global hotkey blocker is a
  no-op**. Wayland disallows user-space global keyboard grabs and X11
  would require per-WM work. Quit your launcher before starting `just`
  if you want the full lockdown.

---

## Philosophy

See [AGENTS.md](AGENTS.md) for the full product contract. The short
version: every feature proposal gets asked *does the writing die
without it?* If the answer isn't yes, the feature isn't added.
