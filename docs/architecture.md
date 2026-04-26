# Architecture

This document covers RetroSync's technical architecture, design decisions, and the reasoning behind them.

## Overview

RetroSync is a desktop application for managing retro game ROM libraries. It integrates with [IGDB](https://www.igdb.com/) for game metadata, supports extensible addon sources for discovering and importing ROMs, and organizes files by platform and device compatibility.

The app is built with **Electron** (main + renderer processes), **React 19** for the UI, **SQLite** via Drizzle ORM for persistence, and a custom **addon system** that allows external plugins to provide game and BIOS sources.

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop shell | Electron | Cross-platform desktop app with native filesystem access |
| UI framework | React 19 | Component model, ecosystem, concurrent features |
| Build tooling | Vite + electron-vite | Fast HMR, native ESM, Electron-aware bundling |
| Styling | Tailwind CSS 4 | Utility-first, custom design tokens, no runtime cost |
| State management | Zustand | Minimal boilerplate, no providers, simple selectors |
| Database | SQLite (better-sqlite3) | Embedded, zero-config, synchronous reads for Electron main process |
| ORM | Drizzle ORM | Type-safe queries, lightweight, SQLite-native, migration tooling |
| Accessible UI | Headless UI | Unstyled, WAI-ARIA compliant primitives (popovers, menus) |
| Icons | lucide-react | Tree-shakeable, consistent icon set |
| Fuzzy search | Fuse.js | Client-side fuzzy matching for ROM name normalization |
| Logging | electron-log | Scoped logging for main/renderer/addon processes |
| Packaging | electron-builder | Cross-platform installers (NSIS, DMG, AppImage, deb, snap) |

## Process Architecture

```
┌──────────────────────────────────────────────────┐
│                    Electron                       │
│                                                   │
│  ┌─────────────┐   IPC Bridge   ┌──────────────┐ │
│  │ Main Process │◄─────────────►│   Renderer    │ │
│  │              │  (preload.ts)  │   (React)     │ │
│  │  - Addons    │               │  - Pages      │ │
│  │  - Database  │               │  - Components │ │
│  │  - Imports   │               │  - Store      │ │
│  │  - IGDB API  │               │               │ │
│  │  - Config    │               │               │ │
│  └─────────────┘               └──────────────┘  │
└──────────────────────────────────────────────────┘
```

### Main Process (`src/main/`)

The main process owns all I/O: database access, filesystem operations, network requests (e.g. IGDB API), and addon lifecycle management. It exposes functionality to the renderer exclusively through typed IPC handlers.

**Key modules:**
- `index.ts` — App lifecycle, window creation, IPC handler registration
- `config.ts` — JSON config file management with deep-merge updates
- `igdb.ts` — IGDB OAuth2 authentication, game search, metadata fetching, image caching
- `platforms.ts` — Device profiles, platform definitions, active platform ID resolution
- `db/` — SQLite setup (WAL mode), Drizzle schema, migrations
- `addons/` — Addon registry, loader, context, IPC, type contracts
- `imports/` — Import queue manager, transfer lifecycle, staging/library file placement
- `bios/` — BIOS source aggregation, local scanning, installation

### Preload (`src/preload/`)

A thin bridge that exposes a typed `window.api` object to the renderer using Electron's `contextBridge`. Each namespace (`api.igdb`, `api.config`, `api.addons`, `api.imports`, etc.) maps 1:1 to IPC channels. The preload script never contains business logic.

### Renderer (`src/renderer/`)

A React 19 SPA with Zustand for state management. The renderer never accesses the filesystem or database directly — all data flows through `window.api.*` IPC calls.

**Key parts:**
- `store/useAppStore.ts` — Single Zustand store for all application state
- `pages/` — Top-level views (Dashboard, Library, Imports, Platform Setup, Addons, Settings, About)
- `components/` — Reusable UI (GameCard, GameDetailPanel, HeroBanner, Sidebar, etc.)
- `types/` — Shared renderer-side type definitions

## Design Decisions

### Why SQLite over Electron Store / JSON files?

The app needs to query indexed ROM metadata (tens of thousands of entries from addon indexes), track import status, and store library games with relational lookups. SQLite with WAL mode gives us:
- Fast reads without blocking writes
- Proper indexing for search queries
- Shared access between main process and addons
- Atomic transactions for batch inserts (addon indexing)

JSON-based stores would struggle with the index sizes and lack query capabilities.

### Why a shared database for addons?

Addons get a Drizzle ORM instance and raw SQLite handle through their context. This means addons create their own tables in the same database file rather than managing separate databases.

**Trade-offs:**
- (+) Single file to backup/migrate
- (+) Addons can use Drizzle's full query builder
- (+) No inter-process database coordination
- (-) Addons must namespace their tables to avoid collisions
- (-) A misbehaving addon could theoretically corrupt shared data

This was chosen over separate databases because addon queries often correlate with app data (e.g., checking import status for a source), and a single WAL-mode database handles concurrent access well.

### Why Zustand over Redux / Context?

Zustand was chosen for minimal boilerplate and simplicity:
- No providers or wrappers needed
- Selectors are plain functions — fine-grained re-renders
- Works naturally with React 19's concurrent features
- Single store file keeps all state co-located and easy to trace

The store (`useAppStore.ts`) contains all application state: navigation, search, game data, IGDB integration, device profiles, and user preferences.

### Why an addon system?

ROM sources vary widely — local folders, archive CDNs, community databases — and each has different discovery, indexing, and transfer mechanisms. Rather than hardcoding source types, RetroSync uses an addon architecture where each source is a self-contained plugin.

**Design principles:**
- **Capability-based:** Addons declare what they can do (`sources:games`, `sources:bios`, `metadata`)
- **Context injection:** Addons receive a controlled context (database, config, logging) rather than importing app internals
- **Transfer contract:** All addons implement the same `createTransfer()` interface, so the import manager treats every source uniformly
- **Dynamic loading:** External addons are loaded from `{userData}/addons/` at startup, allowing user-installed plugins without app rebuilds

### Why Tailwind CSS with custom design tokens?

The app uses a dark theme with retro gaming aesthetics. Tailwind's utility classes keep styling co-located with components. Custom CSS variables (`--color-rs-accent`, `--color-rs-panel`, etc.) define the design system:

```css
--color-rs-bg: #0f0f0f
--color-rs-panel: #1a1a1a
--color-rs-accent: #6366f1      /* Indigo */
--color-rs-text: #f3f4f6
--color-rs-border: #2a2a2a
```

This approach allows potential theming in the future by swapping CSS variable values.

## Data Flow

### Game Discovery & Import

```
User searches game
       │
       ▼
Renderer ──IPC──► Main (IGDB API) ──► Returns game metadata
       │
       ▼
User opens game detail panel
       │
       ▼
Renderer ──IPC──► Main (Addon Registry)
                    │
                    ├──► Addon A: findSources(gameName, platformIds)
                    ├──► Addon B: findSources(gameName, platformIds)
                    └──► ... (parallel)
                    │
                    ▼
              Aggregated results returned to renderer
       │
       ▼
User clicks Import on a source
       │
       ▼
Renderer ──IPC──► Import Manager
                    │
                    ├── Creates staging directory
                    ├── Calls addon.createTransfer(sourceRef, stagingPath, callbacks)
                    ├── Tracks progress via callbacks
                    ├── On completion: moves file to library/{platform}/
                    └── Broadcasts progress events to renderer
```

### Import Queue

The import manager maintains a concurrency-limited queue (default: 3 concurrent transfers). Imports go through these states:

```
queued ──► importing ──► completed
  │            │
  │            ├──► paused ──► importing (resume)
  │            │
  │            └──► error ──► importing (retry)
  │
  └──► cancelled (removed)
```

Key behaviors:
- Paused imports persist across app restarts
- Staging files are cleaned up on startup if their import records are stale
- File placement handles cross-filesystem moves (copy + delete fallback)
- Each addon controls whether pause/resume is supported via `TransferHandle.supportsPause`

## Database Schema

### Main Application

**`library_games`** — User's saved game collection
| Column | Type | Description |
|--------|------|-------------|
| `igdb_id` | integer (PK) | IGDB game identifier |
| `title` | text | Game title |
| `platforms` | text (JSON) | Full platform names |
| `cover_image_id` | text | IGDB cover image ID |
| `year`, `developer`, `genre`, `description` | text | Metadata |
| `rating` | real | User rating (0-5) |
| `igdb_game_type` | integer | Game type category |
| `added_at` | text | Timestamp |

**`imports`** — Import queue and history
| Column | Type | Description |
|--------|------|-------------|
| `id` | text (PK) | UUID |
| `addon_id` | text | Source addon |
| `source_ref` | text | Addon-specific source reference |
| `rom_filename` | text | Target filename |
| `status` | text | queued / importing / paused / completed / error |
| `progress` | real | 0.0 to 1.0 |
| `total_size`, `imported_size` | integer | Bytes |
| `save_path` | text | Final library path |

### Addon Tables

Addons create their own tables using the raw SQLite handle. For example, a source addon might create:

- An index table for discovered ROM entries (with platform, filename, size, region)
- A status table tracking which collections have been indexed

Addons are responsible for running their own migrations during `init()`.

## Configuration

App configuration is stored at `{userData}/retrosync-config.json` as a flat JSON file with deep-merge semantics for partial updates.

```typescript
interface AppConfig {
  igdb: { clientId: string; clientSecret: string }
  igdbSetupSkipped: boolean
  igdbExcludedGameTypes: number[]
  devices: string[]                    // Selected device profile IDs
  customDevices: CustomDevice[]        // User-created device profiles
  addons: {
    enabled: string[]                  // Enabled addon IDs
    sourcesDisplayMode: 'compact' | 'expandable'
    config: Record<string, unknown>    // Per-addon config keyed by addon ID
  }
  libraryPath: string                  // Final ROM storage location
  importPath: string                   // Staging directory for active imports
  maxConcurrentImports: number         // Concurrent transfer limit
  importsBadgeStyle: 'count' | 'dot' | 'none'
}
```

## Platform & Device System

RetroSync supports 35 retro platforms (NES, SNES, N64, PS1, PS2, Dreamcast, etc.) and ships with 11 pre-configured device profiles (Miyoo Mini Plus, Anbernic RG35XX, Steam Deck, etc.).

Each device profile maps to a set of IGDB platform IDs it can emulate, organized by performance tiers:
- **Tier 1** (lightweight): NES, SNES, Game Boy, Master System, etc.
- **Tier 2** (moderate): GBA, Mega Drive, Neo Geo, TurboGrafx, etc.
- **Tier 3** (demanding): PS1, N64, Nintendo DS
- **Tier 4** (heavy): PS2, GameCube, Dreamcast, Wii, 3DS

The union of all selected device platform IDs determines which games and sources are relevant to the user. This is exposed to addons via `context.getActivePlatformIds()`.

## Security Considerations

- IGDB API credentials are stored in the local config file (not in the repository)
- Addons run in the same Node.js process as the main app (no sandboxing)
- Addon installation requires explicit user action
- The preload script exposes only whitelisted IPC channels via `contextBridge`
- No remote code execution — addons are loaded from local disk only
