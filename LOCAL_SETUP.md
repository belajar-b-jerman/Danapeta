# Local Setup

## Recommended Environment
- Node.js 22 LTS or newer.
- npm 10 or newer.

The project currently uses Vite 6, React 19, TypeScript 5.7, Tailwind 3, Dexie 4, Zustand 5, Recharts 2, and Framer Motion 12.

## Install
```bash
npm install
```

## Run Locally
```bash
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```txt
http://localhost:5173
```

## Build
```bash
npm run build
```

## Preview Production Build
```bash
npm run preview
```

## Test PWA Installability
1. Run `npm run build`.
2. Run `npm run preview`.
3. Open the preview URL in Chrome or Edge.
4. Open DevTools.
5. Go to Application > Manifest and confirm:
   - app name is `Uang Planner`
   - icons are loaded
   - display mode is `standalone`
   - start URL is `/`
6. Go to Application > Service Workers and confirm the service worker is registered.
7. Use the browser install button or DevTools installability checks.
8. Toggle offline mode in DevTools and reload the app shell.

## Test IndexedDB Persistence
1. Run the app locally.
2. Open DevTools > Application > IndexedDB.
3. Confirm the `planner_keuangan` database exists.
4. Confirm seeded `categories` and `subcategories` tables exist after first boot.
5. Switch the theme in the page header.
6. Refresh the page.
7. Confirm the selected theme persists through `appSettings`.

Future transaction forms can use the demo generator in `src/lib/demoData.ts`. The opt-in repository helper `seedDemoDataset` lives in `src/db/repositories/demoRepository.ts`; it is intentionally not called on app boot.

## Test Responsiveness

### Mobile
1. Open DevTools device toolbar.
2. Select a phone viewport such as iPhone SE, iPhone 14, or Pixel 7.
3. Confirm:
   - bottom navigation is visible
   - sidebar is hidden
   - touch targets are at least 44 px tall
   - dashboard cards stack cleanly
   - no text overlaps controls

### iPad / Tablet
1. Test widths around 768 px to 1024 px.
2. Confirm:
   - desktop sidebar appears at the medium breakpoint
   - dashboard spacing remains comfortable
   - charts keep stable height
   - page header remains readable

### Desktop
1. Test widths around 1280 px and 1440 px.
2. Confirm:
   - sidebar remains fixed
   - content is constrained and centered
   - chart grid uses two-column layout
   - bottom navigation is hidden

## Local Validation Commands
```bash
npm run build
npm run preview
```

If linting is configured with project-specific rules later:

```bash
npm run lint
```
