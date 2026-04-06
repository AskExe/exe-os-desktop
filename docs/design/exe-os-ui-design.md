# Exe OS — UI Design System & Wireframes

**Author:** mari (CMO)
**Date:** 2026-04-01
**Status:** Complete
**Stitch Project:** `projects/1519805459721280981` — "Exe OS — UI Design"

---

## 1. Design System

### Design Principles

1. **Command center authority** — Dark backgrounds with vibrant accent pops. Feels like mission control, not generic SaaS.
2. **Information density** — Developers want data, not whitespace. Bento grid layouts, compact cards, dense but scannable.
3. **Edgy precision** — Angular typography (Chakra Petch), sharp visual language, tonal depth over flat surfaces.
4. **Consistent status language** — Green=active, Amber=working, Red=error, Gray=idle — everywhere, always.

### Color Palette (Founder Approved)

| Role | Hex | Usage |
|------|-----|-------|
| Background | `#0F0E1A` | Page/app background (night blue-black) |
| Surface | `#1A1832` | Cards, panels, sidebars |
| Surface Elevated | `#2A2548` | Modals, dropdowns, popovers |
| Border | `#3D3660` | Subtle borders (use sparingly — prefer tonal shifts) |
| Text Primary | `#F0EDE8` | Headings, body text (warm white) |
| Text Secondary | `#A09CAF` | Muted labels, timestamps (muted lavender) |
| Primary | `#6B4C9A` | Deep purple — brand primary, selected states, nav highlights |
| Secondary | `#C77DBA` | Soft pink — role badges, secondary highlights |
| CTA/Accent | `#F5D76E` | Moonlight yellow — call-to-action buttons (dark text on yellow) |
| Light BG | `#F3EFF8` | Warm lavender — light mode backgrounds |
| Status Green | `#22C55E` | Active status, success |
| Status Amber | `#F59E0B` | Working status, warnings |
| Status Red | `#EF4444` | Error status, P0 priority badge |
| Status Gray | `#6B7280` | Idle status |
| User Bubble | `#2A2548` | User chat messages |

### Typography (Founder Approved)

| Role | Font | Weight | Sizes |
|------|------|--------|-------|
| Display/Headlines | Chakra Petch | 700 | 24/32/48px |
| Body | DM Sans | 400 | 14/16px |
| Code/Data | Geist Mono | 400 | 12/14px |
| Labels | DM Sans / Geist | 500 | 12px uppercase |

**Type scale:** 12 / 14 / 16 / 20 / 24 / 32 / 48px
**Line height:** 1.5 for body, 1.2 for headlines
**Letter spacing:** -0.02em for display, 0.05em for labels

**CSS imports:**
```css
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
/* Geist Mono: install via npm or self-host */
```

> **Note:** Stitch uses Space Grotesk as the closest substitute for Chakra Petch. Implementation must use Chakra Petch (Google Fonts).

### Spacing Scale

Base unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Inline gaps |
| `space-2` | 8px | Compact padding |
| `space-3` | 12px | Component internal padding |
| `space-4` | 16px | Card padding, grid gaps |
| `space-6` | 24px | Section internal spacing |
| `space-8` | 32px | Section gaps |
| `space-12` | 48px | Major section dividers |

### Corner Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Badges, chips |
| `radius-md` | 8px | Cards, inputs, buttons |
| `radius-lg` | 12px | Modals, large panels |
| `radius-full` | 9999px | Avatars, status dots |

### Elevation (Tonal Layering)

No drop shadows for static elements. Depth via surface color shifts:

```
Background (#0F0E1A) → Surface (#1A1832) → Elevated (#2A2548) → Float (#3D3660)
```

Floating elements (modals, popovers): `box-shadow: 0 20px 40px rgba(107, 76, 154, 0.12)` (purple-tinted glow)

**The "No-Line" Rule:** Avoid 1px solid borders for sectioning. Define boundaries through background color shifts between surface tiers. Borders only for accessibility fallback (use `#3D3660` at 15% opacity).

### Status Indicators

| Status | Color | Dot | Usage |
|--------|-------|-----|-------|
| Active | `#22C55E` | Solid green | Employee online and available |
| Working | `#F59E0B` | Solid amber | Employee processing a task |
| Error | `#EF4444` | Solid red | Failure, needs attention |
| Idle | `#6B7280` | Solid gray | No current task |
| Offline | `#374151` | Hollow gray | Session not running |

### Priority Badges

| Priority | Color | Background |
|----------|-------|------------|
| P0 | `#EF4444` | `rgba(239,68,68,0.15)` |
| P1 | `#F59E0B` | `rgba(245,158,11,0.15)` |
| P2 | `#3B82F6` | `rgba(59,130,246,0.15)` |
| P3 | `#6B7280` | `rgba(107,114,128,0.15)` |

---

## 2. TUI Wireframes (Ink — React for CLI)

### 2a. Dashboard View

```
+------------------+-----------------------------------------------+
| EXE OS           |  Team Overview          All Systems Operational |
|                  |                                 [green badge]  |
| > Dashboard      | +--------------------+ +--------------------+ |
|   Chat           | | E  exe       . ACT | | Y  yoshi     . WRK | |
|   Tasks          | | COO                | | CTO                | |
|   Memory         | | Reviewing PR #47   | | Intercom queue sys  | |
|   Gateway        | | mem: 2,841         | | mem: 1,523         | |
|   Settings       | +--------------------+ +--------------------+ |
|                  | +--------------------+ +--------------------+ |
|                  | | M  mari       . WRK| | T  tom        . IDL| |
|                  | | CMO                | | Principal Eng      | |
|                  | | Designing UI system| | --                 | |
|                  | | mem: 892           | | mem: 456           | |
|                  | +--------------------+ +--------------------+ |
|                  |                                                |
|                  | Recent Activity                                |
|                  | 10:46 . yoshi  Pushed feat/intercom-queue      |
|                  | 10:42 . exe    Created review task for yoshi   |
|                  | 10:38 . mari   Started UI design task          |
|                  | 10:15 . tom    Completed list_tasks fix        |
|                  | 09:50 . exe    Approved PR #45                 |
|                  |                                                |
+------------------+------------------------------------------------+
| 18,241 memories | 47 tasks today | 3 providers | 99.2% uptime    |
+------------------+------------------------------------------------+
```

**Ink components:** `<Box>`, `<Text>`, custom `<Card>`, `<StatusDot>`, `<Badge>`

### 2b. Chat View

```
+------------------+-----------------------------------------------+
| EXE OS           |  yoshi (CTO)               . Working           |
|                  |------------------------------------------------|
|   Dashboard      |                                                |
| > Chat           |  You: What's the status on the intercom queue  |
|   Tasks          |       system?                                  |
|   Memory         |                                                |
|   Gateway        |  yoshi: Implemented the persistent notification|
|   Settings       |  queue. Key changes:                           |
|                  |  1) Replaced tmux send-keys with file-based    |
|  ---- Chats ---  |     queue polling                               |
|  . exe     (COO) |  2) Added retry w/ exponential backoff         |
|  . yoshi   (CTO) |  3) Messages persist across restarts           |
|  . mari    (CMO) |  Tests passing -- 12/12 green.                 |
|  . tom     (PE)  |                                                |
|                  |  You: Nice. Push it and create the review task  |
|                  |       for exe.                                  |
|                  |                                                |
|                  |  yoshi:                                        |
|                  |  +--------------------------------------+      |
|                  |  | $ git push origin feat/intercom-queue|      |
|                  |  | * [new branch] feat/intercom-queue   |      |
|                  |  +--------------------------------------+      |
|                  |  Done. Review task created for exe -- P1.      |
|                  |                                                |
+------------------+------------------------------------------------+
| > Message yoshi...                                         [Send] |
+-------------------------------------------------------------------+
```

**Ink components:** `<TextInput>`, `<ScrollBox>`, `<ChatBubble>`, `<CodeBlock>`

### 2c. Task Board View

```
+------------------+-----------------------------------------------+
| EXE OS           |  Task Board     [All Projects v] [+ New Task]  |
|                  |------------------------------------------------|
|   Dashboard      |                                                |
|   Chat           | OPEN (4)      IN PROGRESS (2)  REVIEW (1)     |
| > Tasks          | +-----------+ +-------------+ +-------------+ |
|   Memory         | |.P0 Fix mem| |.P0 Intercom | |.P1 Auto-inj | |
|   Gateway        | | yoshi     | | yoshi  2h   | | yoshi       | |
|   Settings       | | exe-os    | | exe-os      | | rev: exe    | |
|                  | +-----------+ +-------------+ +-------------+ |
|                  | |.P1 Blog   | |.P0 Design UI|                 |
|                  | | mari      | | mari   1h   | DONE (3)       |
|                  | | marketing | | exe-os      | +-------------+ |
|                  | +-----------+ +-------------+ |v P1 Port fix| |
|                  | |.P1 Rate   |                 | yoshi       | |
|                  | | yoshi     |                 +-------------+ |
|                  | | exe-os    |                 |v P1 CTA rpt | |
|                  | +-----------+                 | mari        | |
|                  | |.P2 Onboard|                 +-------------+ |
|                  | | mari      |                 |v P2 list fix| |
|                  | | marketing |                 | tom         | |
|                  | +-----------+                 +-------------+ |
+------------------+------------------------------------------------+
```

**Ink components:** `<Column>`, `<TaskCard>`, `<PriorityBadge>`, `<AssigneeChip>`

### 2d. Memory Explorer View

```
+------------------+-----------------------------------------------+
| EXE OS           |  Memory Explorer                18,241 memories|
|                  |  [Search memories semantically...          ]   |
|   Dashboard      |  [All Agents v] [All Projects v] [Type v]     |
|   Chat           |------------------------------------------------|
| > Memory         | | . yoshi | exe-os | code decision | 2h  0.94||
|   Gateway        | | Chose SQLCipher over plain SQLite for      ||
|   Settings       | | memory encryption -- AES-256-GCM at rest   ||
|                  | |-------------------------------------------||
|                  | | . exe   | exe-os | review        | 4h  0.91||
|                  | | Approved yoshi's intercom queue PR         ||
|                  | |-------------------------------------------||
|                  | | . mari  | mktg   | content       | 6h  0.87||
|                  | | CTA analysis -- 'Start Free' wins by 23%  ||
|                  | |-------------------------------------------||
|                  | | . tom   | exe-os | bug fix       | 1d  0.85||
|                  | | Fixed list_tasks scope defaulting to global||
|                  | |-------------------------------------------||
|                  | | . exe   | exe-os | behavior      | 2d  0.82||
|                  | | After fixing exe-os bugs, check OSS repo  ||
|                  | +-------------------------------------------+|
+------------------+------------------------------------------------+
```

**Ink components:** `<SearchInput>`, `<FilterChips>`, `<MemoryCard>`, `<ScoreBadge>`

### 2e. Gateway Monitor View

```
+------------------+-----------------------------------------------+
| EXE OS           |  Gateway Monitor        3 Active Channels      |
|                  |  [Last 24h v]                                  |
|   Dashboard      |                                                |
|   Chat           | +---------+ +---------+ +---------+ +--------+|
|   Tasks          | | Convos  | | Msgs    | | Resp    | | CSAT   ||
| > Gateway        | |   12    | |  847    | |  1.2s   | | 4.8/5  ||
|   Settings       | | +3 .    | | +12% .  | | -0.3s . | | same . ||
|                  | +---------+ +---------+ +---------+ +--------+|
|                  |                                                |
|                  | Live Conversations    | Msg Volume (24h)       |
|                  | . Sarah M. (WA)      |     __                  |
|                  |   Pricing  2m        |    /  \    green=auto   |
|                  | . James K. (Web)     |   /    \   blue=human   |
|                  |   Support  5m        |  /      \__             |
|                  | . Anon (Signal)      | /          \            |
|                  |   Inquiry  12m       |/            \___        |
|                  | . Maria L. (WA)      | 6a  12p  6p  12a       |
|                  |   Refund   18m  ESC  |                         |
|                  |                      |                         |
|                  | Channel Health                                 |
|                  | . WhatsApp  Connected  456 msgs  Twilio       |
|                  | . Web Chat  Active     312 msgs  Self-hosted   |
|                  | . Signal    Rate-lim   79 msgs   Signal API    |
+------------------+------------------------------------------------+
```

**Ink components:** `<StatCard>`, `<ConversationList>`, `<AsciiChart>`, `<ChannelStatus>`

---

## 3. Desktop App Wireframes (Tauri + React)

All screens have been generated as interactive HTML/CSS in Stitch and can be previewed in the Stitch project.

### 3a. Dashboard

**Stitch Screen:** `96585d0488354636b1dcef4b61a44e24`

**Layout:**
- Left: 64px narrow sidebar with icon+label navigation (6 sections)
- Main: Full-width content area
- Header: "Exe OS" brand + "Team Overview" + system status badge
- Body: 2x2 bento grid of employee cards
- Footer: Activity feed + system stats bar

**Key interactions:**
- Click employee card -> navigates to Chat with that employee
- Click activity entry -> navigates to relevant task/review
- Status badges update in real-time via WebSocket
- Employee cards show live streaming indicator when agent is generating

### 3b. Chat Interface

**Stitch Screen:** `7b9d9d6dc7194ecab8559b1fd4137b7a`

**Layout:**
- Left sidebar: Nav icons + conversation list with employee status dots
- Main: Chat header (agent name, role, status) + message thread + input bar
- Messages: Right-aligned user bubbles (#1E3A5F), left-aligned agent bubbles (#1E293B) with colored left border
- Code blocks render in Geist Mono with syntax highlighting

**Key interactions:**
- Click employee in sidebar -> switch conversation
- Agent responses stream in real-time (character-by-character with cursor blink)
- Code blocks have copy button on hover
- "View Tasks" button opens side panel with agent's task list
- Typing indicator shows when agent is processing

### 3c. Task Board (Kanban)

**Stitch Screen:** `065303e9f4774a72a6cdf3ffc2d1010c`

**Layout:**
- Top bar: Heading + filter dropdowns (Project, Employee, Priority) + "+ New Task" CTA
- Body: 4 kanban columns (Open, In Progress, In Review, Done)
- Cards: Surface color with priority-colored left border, assignee avatar, project tag

**Key interactions:**
- Drag-and-drop cards between columns (updates task status via MCP)
- Click card -> opens detail modal with full task description, comments, history
- "+ New Task" -> modal with assignee dropdown, priority selector, project picker
- Filter chips narrow visible tasks
- "Done" column cards fade slightly (opacity: 0.7)

### 3d. Memory Explorer

**Stitch Screen:** `24b9fa9d9507460ead03445980575bbf`

**Layout:**
- Top: Heading with total count + semantic search bar + filter chips
- Main: Scrollable list of memory cards with colored left borders (agent-specific)
- Right sidebar: Expanded detail panel for selected memory

**Key interactions:**
- Search triggers semantic similarity search (embeddings-based)
- Click memory card -> expands in right panel with full content, metadata, related memories
- Filter by agent, project, date range, memory type
- Relevance scores shown in Geist Mono
- Embeddings visualization: interactive dot cluster (t-SNE projection)

### 3e. Gateway Monitor

**Stitch Screen:** `0cdeaf79bbe146cabec19e4edcdeccaa`

**Layout:**
- Top: Header + channel count badge + time range selector
- Stat row: 4 metric cards with trend arrows
- Middle: Split panel — live conversations list + message volume line chart
- Bottom: Channel health status cards

**Key interactions:**
- Click conversation -> opens transcript in slide-over panel
- Chart is interactive (hover for per-hour breakdown)
- Time range selector reloads all data
- Channel status cards link to provider settings
- "Escalated" conversations highlighted in red with alert badge

---

## 4. Navigation Flow

```
                         +-------------+
                         |  Dashboard  |
                         |  (home)     |
                         +------+------+
                                |
           +--------------------+--------------------+
           |          |         |         |          |
     +-----+--+ +----+---+ +---+----+ +--+-------+ +--------+
     |  Chat  | |  Tasks | | Memory | | Gateway  | |Settings|
     +--------+ +--------+ +--------+ +----------+ +--------+
         |           |          |           |            |
    Employee    Task Detail  Memory     Conversation  Provider
    Selector    Modal        Detail     Transcript    Config
         |                   Panel     Panel         Panel
    Conversation
    Thread
```

**Navigation rules:**
- Sidebar is persistent — always visible, never collapses (desktop)
- Active section highlighted with green accent (or purple for Memory)
- Dashboard is home — logo/brand click returns here
- Cross-linking: Employee cards (Dashboard) -> Chat; Activity entries -> relevant Task/Memory
- Breadcrumbs only in nested views (e.g., Memory > Detail)
- Keyboard shortcuts: `Cmd+1-6` for quick section switching (desktop), `1-6` in TUI

### Mobile (Tauri mobile target)

- Sidebar collapses to bottom tab bar (5 icons: Dashboard, Chat, Tasks, Memory, Gateway)
- Settings accessible from profile icon in top-right
- Cards stack vertically instead of grid
- Chat is full-screen with back button
- Kanban becomes swipeable columns

---

## 5. Component Inventory

### Shared Components (Both TUI and Desktop)

| Component | TUI (Ink) | Desktop (React) | Purpose |
|-----------|-----------|-----------------|---------|
| `StatusDot` | Colored ANSI dot character | 8px SVG circle | Employee/channel status |
| `EmployeeCard` | Box with text layout | Styled div with avatar | Agent overview |
| `TaskCard` | Box with priority prefix | Card with left border | Task display |
| `MemoryCard` | Colored-border box | Card with metadata row | Memory entry |
| `PriorityBadge` | Colored text prefix `[P0]` | Pill badge component | Task priority |
| `ChatBubble` | Indented text with prefix | Rounded div with alignment | Chat messages |
| `CodeBlock` | Plain monospace block | Syntax-highlighted div | Code display |
| `SearchInput` | Text input component | Styled input with icon | Semantic search |
| `FilterChips` | Selectable text options | Pill buttons | Data filtering |
| `StatCard` | Box with large number | Card with trend arrow | Metric display |
| `ActivityFeed` | Timestamped text list | Scrollable list component | Recent events |
| `ConversationItem` | Text line with dot | List row with avatar | Chat list entry |
| `ChannelStatus` | Status text line | Card with provider badge | Gateway health |
| `NavItem` | Highlighted text item | Icon + label sidebar link | Navigation |

### Desktop-Only Components

| Component | Purpose |
|-----------|---------|
| `KanbanColumn` | Drag-drop column container |
| `TaskModal` | Full task detail overlay |
| `MemoryDetailPanel` | Right sidebar with expanded content |
| `ConversationTranscript` | Slide-over panel for gateway chats |
| `LineChart` | Interactive message volume chart |
| `EmbeddingsViz` | t-SNE dot cluster for memory vectors |
| `NotificationBell` | Real-time alert dropdown |
| `SettingsPanel` | Tabbed configuration interface |

### TUI-Only Components

| Component | Purpose |
|-----------|---------|
| `AsciiChart` | Terminal line chart using braille chars |
| `ScrollBox` | Scrollable content region |
| `TextInput` | Focused text input with prompt |
| `KeyboardHint` | Bottom bar showing available shortcuts |
| `SplitPane` | Side-by-side terminal panes |

---

## 6. Recommended Style & Palette

### Style: "Sovereign Command" (founder-approved brand)

**Based on:** Angular command-center aesthetic + founder-approved Option B typography direction

**Why this style:**
- Deep purple (#6B4C9A) as primary creates authority and distinctiveness — not generic SaaS blue
- Soft pink (#C77DBA) as secondary adds warmth without softness — role badges, highlights
- Moonlight yellow (#F5D76E) as CTA creates maximum contrast on dark backgrounds — unmissable action buttons
- Night blue-black (#0F0E1A) is deeper and more immersive than standard slate
- The purple/pink/yellow triad is distinctive — no other AI orchestration tool looks like this

**The palette at a glance:**

```
Background:   #0F0E1A  ████████████████████████████████  night blue-black
Surface:      #1A1832  ████████████████████████████████  dark purple surface
Elevated:     #2A2548  ████████████████████████████████  modal/dropdown
Border:       #3D3660  ████████████████████████████████  subtle (use sparingly)
Text:         #F0EDE8  ████████████████████████████████  warm white
Muted:        #A09CAF  ████████████████████████████████  muted lavender
Primary:      #6B4C9A  ████████████████████████████████  deep purple
Secondary:    #C77DBA  ████████████████████████████████  soft pink
CTA:          #F5D76E  ████████████████████████████████  moonlight yellow
Green:        #22C55E  ████████████████████████████████  active status
Amber:        #F59E0B  ████████████████████████████████  working status
Red:          #EF4444  ████████████████████████████████  error status
```

### Font Pairing Rationale (Option B — Founder Approved)

| Font | Role | Why |
|------|------|-----|
| Chakra Petch 700 | Display/Headlines | Angular, edgy, Thai-inspired sharpened terminals. Game HUD quality. Reads as "command center" — not friendly, not corporate. Distinctive. |
| DM Sans 400 | Body | Clean, geometric, highly readable at small sizes. Softer complement to Chakra Petch's angular edges without being generic. |
| Geist Mono | Code/Data | Vercel's monospace font. Modern, clean, excellent for data tables and terminal-like displays. The "machine layer" of the typography stack. |

---

## Stitch Project Reference

### Cohesive App (v2) — All screens share identical shell

**Project ID:** `12129361177216792129` — "Exe OS — Cohesive App (v2)"
**Design System:** `assets/6487261053406817995`

| Screen | ID | Active Nav |
|--------|----|------------|
| Dashboard | `85991428436c4777a84b01a12128345d` | Dashboard |
| Chat | `495b81983baa4daabbf31c72818ba7fa` | Chat |
| Task Board | `f0ae921c2fa04307a2b987e9db6efaa8` | Tasks |
| Memory Explorer | `4523d80c07de4ec6b31b6a101442bc2d` | Memory |
| Gateway Monitor | `95e109abee604a728b2adc14023e5eec` | Gateway |

**Shell consistency:** All 5 screens use identical 64px sidebar (owl logo, 6 nav items, purple active accent), 56px header bar, 36px footer stats bar. Only the main content area and active nav item change between screens.

All screens can be previewed, iterated, and exported from Stitch.

---

## Implementation Notes

### TUI (Ink)
- Use Ink v5+ with React 18
- Terminal minimum: 80x24 characters, optimized for 120x40
- Color support: 256-color and truecolor (detect with `supports-color`)
- Navigation: keyboard-driven (arrow keys, tab, number shortcuts)
- Real-time updates via `useInterval` hooks polling tmux session state

### Desktop (Tauri)
- Tauri v2 with React 18 + Vite
- System WebView (no Chromium bundle = ~5MB app size)
- Shared React component logic with TUI where possible (data hooks, state management)
- Native window controls, system tray icon with notification badges
- Auto-update via Tauri's built-in updater

### Shared Layer
- State management: Zustand (lightweight, works in both targets)
- Data fetching: Direct MCP tool calls (memory, tasks) + tmux session polling
- Real-time: WebSocket for gateway, file-system watching for task updates
- Theme tokens: CSS custom properties (desktop), Ink theme context (TUI)
