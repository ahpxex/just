# Developing just

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) stable
- [Bun](https://bun.sh)
- Platform toolchain:
  - macOS: Xcode command-line tools
  - Windows: Visual Studio Build Tools (C++ workload)
  - Linux: `webkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`

## Dev loop

```sh
bun install
bun run tauri dev
```

For quick iteration on the 42-minute session dialog without waiting
42 minutes, shorten the session length:

```sh
VITE_SESSION_SECONDS=30 bun run tauri dev
```

The variable is only honored in debug builds.

## Release build (local)

```sh
bun run tauri build
```

Output in `src-tauri/target/release/bundle/`. Unsigned macOS bundles
trigger Gatekeeper; unsigned Windows bundles trigger SmartScreen.

## Signing

### macOS

Export the signing identity and notarization credentials before
building. The Tauri CLI picks them up automatically.

```sh
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"   # appleid.apple.com
export APPLE_TEAM_ID="TEAMID"

./scripts/release.sh
```

`scripts/release.sh` is a thin wrapper that fails early if any of
these are missing.

First-time setup:

1. Join the Apple Developer Program and create a *Developer ID
   Application* certificate.
2. Generate an app-specific password at <https://appleid.apple.com>.
3. Find your team id at *developer.apple.com → Account → Membership*.

### Windows

Set `TAURI_BUNDLE_WINDOWS_CERTIFICATE_THUMBPRINT` in the environment,
or configure `bundle.windows.certificateThumbprint` in
`src-tauri/tauri.conf.json`. An EV certificate is what clears
SmartScreen warnings on first download.

## Release pipeline

Tag a commit with `v*.*.*` and push:

```sh
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/release.yml` runs a matrix across macOS
(universal binary), Windows, and Ubuntu 22.04. It invokes
`tauri-apps/tauri-action`, which builds the bundles, creates a
draft GitHub Release named `just v0.1.0`, and attaches the
artifacts.

If the Apple signing secrets are configured in *Settings → Secrets
and variables → Actions*, the macOS bundle is signed and notarized
during the run. If not, it ships unsigned.

Secrets the workflow reads (all optional):

- `APPLE_CERTIFICATE` — base64-encoded `.p12`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

Each release is created as a draft — verify artifacts, then
publish manually.

## Platform status

- **macOS**: fully supported. Tested on Apple Silicon.
- **Windows**: the hotkey blocker (`WH_KEYBOARD_LL`) is implemented
  but has not yet been field-tested on real Windows hardware. The
  writing surface and all file operations work.
- **Linux**: the global hotkey blocker is a deliberate no-op.
  Wayland disallows user-space global keyboard grabs, and X11 would
  require per-WM work. Close your launcher before starting `just`
  if you want the full lockdown.

## Accessibility permission (macOS)

`just` asks for *Accessibility* on first launch so the `CGEventTap`
can swallow system launcher shortcuts. Grant it in *System Settings
→ Privacy & Security → Accessibility*, then relaunch. If you skip
this step the app still runs, but a discreet `launchers unlocked`
indicator appears in the top-left corner and Spotlight / Raycast /
Alfred can escape focus.

## Workspace layout on disk

```
~/Documents/just/
├── 2026-04-22-153412.md    # each piece, creation-timestamped
├── 2026-04-23-091205.md
└── .just/
    ├── state.json          # "last document you had open"
    ├── stats.json          # per-doc writing time and keystrokes
    ├── media/              # pasted images, one folder per doc
    └── trash/              # deleted drafts, swept after 30 days
```

## Keyboard reference

| key | effect |
|---|---|
| `Cmd+N` / `Ctrl+N` | new document |
| `Cmd+K` / `Ctrl+K` | toggle the drawer of drafts |
| `Cmd+F` / `Ctrl+F` | find within the current document |
| `Cmd+Z` / `Ctrl+Z` | undo, and all the usual text editing |
| `↑` `↓` (in drawer) | navigate |
| `Enter` (in drawer) | open the selected draft |
| `Cmd+Backspace` (in drawer) | discard the selected draft |
| `Z` (within 5s of a discard) | restore |
| `Esc` | close the drawer or search |

In the 42-minute ritual dialog:

| key | effect |
|---|---|
| `L` | leave — save and exit |
| `C` | copy the current draft to clipboard |
| `Enter` / `Space` / `Esc` | continue — begin another 42 minutes |
