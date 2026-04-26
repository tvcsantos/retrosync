# Addon Development Guide

This guide covers everything you need to build an external addon for RetroSync.

## What Addons Can Do

Addons extend RetroSync with new capabilities. Each addon declares one or more capabilities in its manifest:

| Capability      | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `sources:games` | Discover and provide ROM sources for games                 |
| `sources:bios`  | Provide BIOS/firmware file sources                         |
| `metadata`      | Provide additional game metadata (reserved for future use) |

A single addon can declare multiple capabilities.

## Addon Structure

An addon is a directory containing at minimum:

```text
my-addon/
├── manifest.json     # Addon metadata and capabilities
├── index.js          # Entry point (CommonJS module)
└── migrations/       # Optional: Drizzle SQL migrations
    └── 0000_initial.sql
```

### Manifest

The `manifest.json` file describes the addon:

```json
{
  "id": "my-addon",
  "name": "My Addon",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A brief description of what this addon does.",
  "capabilities": ["sources:games"],
  "main": "index.js",
  "configSchema": [
    {
      "key": "someSetting",
      "label": "Some Setting",
      "type": "select",
      "options": [
        { "label": "Option A", "value": "a" },
        { "label": "Option B", "value": "b" }
      ],
      "default": "a"
    }
  ]
}
```

**Required fields:** `id`, `name`, `version`, `author`, `description`, `capabilities`

**Optional fields:**

- `main` — Entry point filename (default: `index.js`)
- `icon` — Icon filename
- `homepage` — URL to addon homepage
- `configSchema` — Array of config fields exposed in the UI
- `minAppVersion` — Minimum compatible RetroSync version

**Config field types:** `select`, `multi-select`, `number`, `path`, `text`

### Entry Point

The entry point must export a factory function that receives a context object and returns an addon instance:

```javascript
// index.js (CommonJS)
module.exports.default = function createMyAddon(context) {
  const { db, sqlite, log } = context

  return {
    manifest: {
      id: 'my-addon',
      name: 'My Addon',
      version: '1.0.0',
      author: 'Your Name',
      description: '...',
      capabilities: ['sources:games'],
      configSchema: []
    },

    async init() {
      log.info('My addon initialized')
    }

    // ... implement capability methods
  }
}
```

> **Note:** The loader overwrites `addon.manifest` with the parsed `manifest.json` from disk, so the inline manifest is only used as a type reference.

## Context API

The context object provides controlled access to the host app's infrastructure:

```typescript
interface AddonContext {
  /** Drizzle ORM instance for type-safe queries. */
  db: BaseSQLiteDatabase<'sync', unknown>

  /** Raw better-sqlite3 handle for DDL (CREATE TABLE, etc.). */
  sqlite: Database.Database

  /** Read this addon's config section. */
  getAddonConfig(): Record<string, unknown>

  /** Resolved platform IDs for the user's configured devices. */
  getActivePlatformIds(): number[]

  /** Absolute path to the addon's install directory. */
  addonDir: string

  /** Writable directory for addon-specific cache/data files. */
  dataDir: string

  /** Scoped logger. */
  log: {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
    debug(...args: unknown[]): void
  }

  /** Import a module from the host app's node_modules. */
  hostImport(moduleId: string): Promise<unknown>
}
```

### Database Access

You get two database handles:

- **`context.db`** (Drizzle ORM) — Use for queries against your own tables. Define your schema with Drizzle and use the full query builder.
- **`context.sqlite`** (better-sqlite3) — Use for DDL operations like `CREATE TABLE` and `CREATE INDEX`. Also useful for raw SQL when Drizzle is overkill.

**Important:** Namespace your tables to avoid collisions. Use your addon ID as a prefix (e.g., `myaddon_sources`).

### Migrations

If your addon needs database tables, create SQL migration files in a `migrations/` directory and run them during `init()`:

```javascript
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'path'

async init() {
  migrate(db, { migrationsFolder: join(context.addonDir, 'migrations') })
}
```

### Host Imports

Use `context.hostImport(moduleId)` to dynamically import modules from the host app's `node_modules`. This avoids bundling heavy or native dependencies into your addon:

```javascript
const WebTorrent = await context.hostImport('webtorrent')
```

Available host modules include `webtorrent`, `parse-torrent`, `fuse.js`, `axios`, `adm-zip`, and any other dependency in the host's `package.json`.

## Implementing Capabilities

### Game Sources (`sources:games`)

Implement these methods to provide ROM sources:

```typescript
interface SourceMethods {
  /** Search for sources matching a game name and platform IDs. */
  findSources(gameName: string, platformIds: number[]): Promise<SourceSearchResult>

  /** Build or refresh the source index. */
  buildIndex(platformIds?: number[]): Promise<{ indexed: number; total: number }>

  /** Return addon status (indexed item count, last update). */
  getStatus(): AddonStatus

  /** Clear all indexed data. */
  clearData(): Promise<void>

  /** Return cache size on disk. */
  getCacheSize(): { files: number; bytes: number }

  /** Create a transfer to import a specific source. */
  createTransfer(
    sourceRef: string,
    stagingPath: string,
    callbacks: TransferCallbacks
  ): TransferHandle

  /** Optional: resume a previously paused transfer. */
  resumeTransfer?(
    sourceRef: string,
    stagingPath: string,
    callbacks: TransferCallbacks
  ): TransferHandle
}
```

#### Source Search Results

```typescript
interface SourceSearchResult {
  sources: SourceResult[]
  matchType: 'exact' | 'fuzzy' | 'none'
}

interface SourceResult {
  id: string
  romFilename: string
  fileSize: number
  region: string | null
  collection: string
  platformId: number
  sourceRef: string // Opaque string your addon can decode in createTransfer
}
```

The `sourceRef` is an opaque string that your addon creates and later decodes in `createTransfer()`. It should encode everything needed to locate and import the file (e.g., a URL, a torrent+filename pair, or a local path).

#### Transfer Contract

The transfer contract is the core integration point between addons and the import manager:

```typescript
interface TransferCallbacks {
  onProgress(progress: number, importedSize: number, totalSize: number): void
  onComplete(): void
  onError(error: Error): void
}

interface TransferHandle {
  /** Whether this transfer supports pause/resume. */
  supportsPause: boolean
  pause(): void
  resume(): void
  cancel(): void
}
```

**How it works:**

1. The import manager calls `addon.createTransfer(sourceRef, stagingPath, callbacks)`
2. Your addon imports/copies the file to `stagingPath`
3. Call `callbacks.onProgress()` periodically with progress updates
4. When the file is fully written to `stagingPath`, call `callbacks.onComplete()`
5. The import manager moves the file from staging to the user's library

**Example:**

```javascript
createTransfer(sourceRef, stagingPath, callbacks) {
  const controller = new AbortController()

  // Start async import
  importFile(sourceRef, stagingPath, {
    signal: controller.signal,
    onProgress: (imported, total) => {
      callbacks.onProgress(imported / total, imported, total)
    }
  })
    .then(() => callbacks.onComplete())
    .catch((err) => {
      if (!controller.signal.aborted) {
        callbacks.onError(err)
      }
    })

  return {
    supportsPause: false,
    pause() { /* no-op */ },
    resume() { /* no-op */ },
    cancel() { controller.abort() }
  }
}
```

### BIOS Sources (`sources:bios`)

Implement `listBiosSources()` to provide BIOS/firmware files:

```typescript
interface BiosMethods {
  listBiosSources(): BiosPlatformGroup[]
}

interface BiosPlatformGroup {
  addonId: string
  platformId: number
  system: string // e.g., "PlayStation", "PlayStation 2"
  platformName: string
  sources: BiosSourceEntry[]
}

interface BiosSourceEntry {
  id: number
  romFilename: string
  romSize: number
  region: string | null
  sourceRef: string
  platformId: number
  system: string
}
```

BIOS sources use the same `createTransfer()` contract for importing files.

### Lifecycle Hooks

```typescript
interface LifecycleHooks {
  /** Called once after the addon is loaded. Run migrations, set up state. */
  init?(): Promise<void>

  /** Called when the app is shutting down. Clean up resources. */
  destroy?(): Promise<void>

  /** Called when the user changes this addon's config. */
  onConfigChanged?(
    oldConfig: Record<string, unknown>,
    newConfig: Record<string, unknown>
  ): Promise<void>
}
```

## Building Your Addon

### TypeScript Setup

Create a `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "outDir": ".",
    "rootDir": "src",
    "declaration": false,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### Bundling with esbuild

Create a `build.mjs`:

```javascript
import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'index.js',
  external: ['better-sqlite3', 'electron', 'electron-log'],
  sourcemap: false,
  minify: false
})
```

**Key points:**

- Bundle format must be `cjs` (CommonJS)
- Externalize host-provided native modules (`better-sqlite3`, `electron`, `electron-log`)
- Use `hostImport()` for other host dependencies instead of bundling them

### Package.json

```json
{
  "name": "retrosync-addon-myname",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "node build.mjs",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.45.0"
  },
  "devDependencies": {
    "esbuild": "^0.25.0",
    "typescript": "^5.8.0",
    "better-sqlite3": "^12.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0"
  }
}
```

## Installation

Users install addons by placing the addon directory in:

```text
{userData}/addons/{addon-id}/
```

Where `{userData}` is:

- **macOS:** `~/Library/Application Support/retrosync/`
- **Windows:** `%APPDATA%/retrosync/`
- **Linux:** `~/.config/retrosync/`

The addon must contain at least `manifest.json` and the entry point file.

RetroSync also supports installing addons from the UI via the Addons page, which copies the addon directory and auto-enables it.

## Debugging

- Use `context.log` for all logging — it's scoped to your addon ID and integrates with the app's log system
- Log files are written to `{userData}/logs/`
- During development, run the host app with `npm run dev` and place your built addon in the addons directory
- Use `context.dataDir` for any cache or temporary files — it's guaranteed to exist and is writable

## API Quick Reference

| Method                                              | When to implement                                        |
| --------------------------------------------------- | -------------------------------------------------------- |
| `init()`                                            | Always — run migrations, set up state                    |
| `destroy()`                                         | If you hold resources (network connections, timers)      |
| `findSources(gameName, platformIds)`                | `sources:games` capability                               |
| `buildIndex(platformIds?)`                          | `sources:games` — if you index sources upfront           |
| `getStatus()`                                       | `sources:games` — report index status                    |
| `clearData()`                                       | `sources:games` — wipe indexed data                      |
| `getCacheSize()`                                    | `sources:games` — report disk usage                      |
| `createTransfer(sourceRef, stagingPath, callbacks)` | `sources:games` or `sources:bios` — required for imports |
| `resumeTransfer(sourceRef, stagingPath, callbacks)` | Optional — if your transfer supports resume              |
| `listBiosSources()`                                 | `sources:bios` capability                                |
| `onConfigChanged(old, new)`                         | If you need to react to config changes                   |
