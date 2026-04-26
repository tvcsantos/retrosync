# Contributing

## Prerequisites

- **Node.js** 18+
- **npm** 9+
- **Git**

## Setup

```bash
git clone https://github.com/tvcsantos/retrosync.git
cd retrosync
npm install
npm run dev
```

This starts the Electron app in development mode with hot module replacement for the renderer.

## Project Structure

```text
retrosync/
├── src/
│   ├── main/                   # Electron main process
│   │   ├── index.ts            # App entry, window creation, IPC handlers
│   │   ├── config.ts           # JSON config management
│   │   ├── igdb.ts             # IGDB API integration
│   │   ├── platforms.ts        # Device profiles & platform definitions
│   │   ├── db/                 # Database setup & schema
│   │   │   ├── index.ts        # SQLite initialization (WAL mode)
│   │   │   └── schema.ts       # Drizzle table definitions
│   │   ├── addons/             # Addon system
│   │   │   ├── types.ts        # Addon interface contracts
│   │   │   ├── context.ts      # Context passed to addon factories
│   │   │   ├── loader.ts       # Dynamic addon loading from disk
│   │   │   ├── registry.ts     # Addon lifecycle & parallel queries
│   │   │   ├── ipc.ts          # Addon IPC handlers
│   │   │   └── local-folder/   # Built-in local folder addon
│   │   ├── imports/            # Import queue manager
│   │   │   ├── manager.ts      # Queue, concurrency, staging, transfer lifecycle
│   │   │   ├── types.ts        # Import types & interfaces
│   │   │   └── index.ts        # Import IPC handlers
│   │   └── bios/               # BIOS management
│   │       └── index.ts        # BIOS source aggregation & installation
│   ├── renderer/               # React frontend
│   │   └── src/
│   │       ├── App.tsx         # Root component, routing, layout
│   │       ├── main.tsx        # React mount
│   │       ├── pages/          # Top-level views
│   │       ├── components/     # Reusable UI components
│   │       ├── store/          # Zustand state management
│   │       ├── types/          # Renderer type definitions
│   │       └── assets/         # CSS, images
│   └── preload/                # Electron preload (IPC bridge)
│       ├── index.ts            # contextBridge API
│       └── index.d.ts          # Type declarations for window.api
├── addons/                     # External addon packages
├── resources/
│   └── migrations/             # Main database migrations
├── build/                      # Build assets (icons, entitlements)
├── docs/                       # Documentation
├── electron.vite.config.ts     # Vite + Electron build config
├── electron-builder.yml        # Packaging config
├── drizzle.config.ts           # Main Drizzle migration config
├── eslint.config.mjs           # ESLint config
├── tsconfig.json               # Root TypeScript config
├── tsconfig.node.json          # Main + preload TypeScript config
└── tsconfig.web.json           # Renderer TypeScript config
```

## Scripts

| Script                   | Description                        |
| ------------------------ | ---------------------------------- |
| `npm run dev`            | Start in development mode with HMR |
| `npm run build`          | Typecheck + build for production   |
| `npm run lint`           | Run ESLint                         |
| `npm run format`         | Run Prettier on all files          |
| `npm run typecheck`      | Run both TypeScript checks         |
| `npm run typecheck:node` | Typecheck main + preload           |
| `npm run typecheck:web`  | Typecheck renderer                 |
| `npm run db:generate`    | Generate main database migrations  |
| `npm run build:mac`      | Build macOS DMG                    |
| `npm run build:win`      | Build Windows installer            |
| `npm run build:linux`    | Build Linux packages               |

## Code Style

### General

- **TypeScript** throughout — no `any` types (enforced by ESLint)
- **Prettier** for formatting — run `npm run format` before committing
- Unused variables/parameters prefixed with `_` (e.g., `_platformIds`)
- Prefer `const` over `let`; avoid `var`
- No default exports for components (except page-level components)

### React

- Functional components only
- Zustand for state — no `useContext` for global state
- Headless UI for accessible interactive primitives
- Tailwind utility classes — no CSS modules or styled-components

### Electron

- All filesystem/network I/O in the main process
- Renderer communicates exclusively through `window.api.*`
- IPC handlers return `{ ok: true, data? }` or `{ ok: false, error }` shapes
- Use `electron-log` scoped loggers, not `console.log`

### Naming

- Files: `kebab-case` for directories, `PascalCase.tsx` for components, `camelCase.ts` for modules
- Types/Interfaces: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE` for module-level constants
- Database tables: `snake_case`

## Verification

Before submitting changes, run:

```bash
npm run lint          # Zero errors, zero warnings
npm run typecheck     # Both node and web configs pass
```

For addon changes, also run:

```bash
cd addons/<addon-name>
npx tsc --noEmit      # Addon typecheck
```

## Database Changes

If you modify the database schema:

1. Edit the schema file (`src/main/db/schema.ts` or addon schema)
2. Generate a migration:

   ```bash
   npm run db:generate                  # Main app
   npm run db:generate:minerva          # Minerva addon
   ```

3. Review the generated SQL in `resources/migrations/` (or `addons/<name>/migrations/`)
4. Test the migration by running the app fresh

## Adding a New Page

1. Create `src/renderer/src/pages/MyPage.tsx`
2. Add the page ID to the `Page` type in `src/renderer/src/types/`
3. Add a route case in `App.tsx`
4. Add a sidebar entry in `Sidebar.tsx`

## Adding a New IPC Channel

1. Add the handler in the appropriate main-process module
2. Register it in `src/main/index.ts` (or the relevant `ipc.ts`)
3. Add the bridge call in `src/preload/index.ts`
4. Add the type declaration in `src/preload/index.d.ts`
5. Call it from the renderer via `window.api.*`
