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

# Dev
npm run tauri dev

# Build
npm run tauri build
```

## Status

Early development. Screen designs complete, integration pending.
