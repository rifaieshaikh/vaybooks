# VayBooks Web (Phase 0/1)

Monorepo workspace for the VayBooks frontend migration. Contains shared packages, the shell host app, a parties micro-frontend stub, and a desktop compose entry that routes between them without module federation.

## Structure

```
web/
├── packages/
│   ├── ui-kit/      # Shared React components (Button, DataTable)
│   ├── theme/       # CSS tokens and theme exports
│   ├── i18n/        # Translation stub (t(key))
│   └── store/       # Redux Toolkit store, slices, RTK Query base API
├── shell/           # Host app (port 5173)
├── mfe-parties/     # Parties MFE stub (port 5174)
└── desktop-compose/ # Single-router compose of shell + parties (port 5175)
```

## Prerequisites

- Node.js 18+
- npm 9+ (workspaces)

## Install

From this directory:

```bash
cd vaybooks/web
npm install
```

## Run

**Shell host** (proxies `/api` → `http://127.0.0.1:8000`):

```bash
npm run dev:shell
```

Open [http://localhost:5173](http://localhost:5173).

**Parties MFE** (standalone):

```bash
npm run dev:parties
```

Open [http://localhost:5174](http://localhost:5174).

**Desktop compose** (shell + parties in one router):

```bash
npm run dev:desktop
```

Open [http://localhost:5175](http://localhost:5175).

## Build

```bash
npm run build
```

## Phase 1 notes

- Module federation placeholders are commented in `shell/vite.config.ts` and `mfe-parties/vite.config.ts`.
- To enable, install `@originjs/vite-plugin-federation` and uncomment the `federation()` blocks.
- The Redux store exposes `sessionSlice` (user/location) and `licenseSlice` (license status enum).
