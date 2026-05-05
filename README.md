# Exe OS Desktop

Tauri desktop shell for [exe-os](https://github.com/AskExe/exe-os). Same brain, visual interface.

## Architecture

```
exe-os (npm package — the engine)
  ├── Memory, Tasks, Behaviors, Skill Learning
  ├── Agent Runtime, Tools, Hooks, Providers
  ├── Gateway (external agents)
  └── MCP Server

exe-os-desktop (this repo — just a shell)
  ├── src-tauri/     ← Rust backend (window, tray, auto-update)
  ├── src/           ← React UI (7 tabs, same logic as CLI)
  └── Imports exe-os as dependency — zero business logic here
```

The desktop app is a **frontend adapter**. All business logic lives in `exe-os`. When bugs are fixed or features are added in exe-os, the desktop app gets them via `npm update`.

## Tabs

1. **Command Center** — team overview, system health, recent activity
2. **Sessions** — project-scoped conversations, launch/attach to agent sessions
3. **Tasks** — kanban board (read-only, tell exe verbally)
4. **Gateway** — external agent monitoring
5. **Team** — internal employees + external agents roster
6. **Memory** — semantic search across all agent memories
7. **Settings** — providers, failover chain, per-employee model config

## Design System

Exe Foundry Bold:
- Background: `#0F0E1A`
- Surface: `#1A1832`
- Primary: `#6B4C9A` (deep purple)
- CTA/Accent: `#F5D76E` (gold)
- Typography: Chakra Petch (headlines), DM Sans (body), Geist Mono (code)

Screen designs in `docs/design/`.

## Stack

- **Tauri v2** — Rust backend, system WebView (~10MB vs Electron's 150MB)
- **React 18** + Vite
- **exe-os** — imported as npm dependency for all business logic
- Supports: macOS, Windows, Linux, iOS, Android (Tauri v2)

## Development

```bash
# Prerequisites
npm install -g exe-os    # The engine
cargo install tauri-cli  # Tauri CLI

# Install
npm install

# Desktop dev
npm run tauri dev

# Build desktop
npm run tauri build
```

### Virtual Office source of truth

The virtual office now lives in the sibling repo at
`../exe-virtual-office`.

- Dev: start the office webview in that repo and point the desktop shell at it with `VITE_VIRTUAL_OFFICE_URL=http://127.0.0.1:5173`
- Bundle sync: after building `../exe-virtual-office/webview-ui`, run `npm run virtual-office:sync` here to copy `dist/webview` into `public/virtual-office`

The desktop app defaults back to the bundled `/virtual-office/index.html`
when no dev URL is configured.

## Status

Early development. Screen designs complete, integration pending.

## AGPL network boundary — Exe CRM

The CRM tab loads `https://crm.askexe.com` in a native `WebviewWindow`
(see `src-tauri/src/lib.rs :: open_crm_window`). The exe-crm codebase is
AGPLv3 and is **never** imported, bundled, or vendored into this repo —
the only contract is the URL string. The webview runs in an isolated
cookie jar so CRM sessions don't leak into the main app. White-label
distributors override the URL via the `EXE_CRM_URL` environment variable
— no rebuild required. Do **not** replace this with an iframe or
`<webview>` element: both would pull third-party origin code into the
Tauri process and break the boundary.
