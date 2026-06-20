# Validation Checklist

Use this checklist before Phase 2 work and after meaningful foundation changes.

## App Boot
- [ ] `npm install` completes.
- [ ] `npm run dev` starts Vite successfully.
- [ ] App opens at the local Vite URL.
- [ ] No console errors on first load.
- [ ] Dashboard route `/` renders.

## Theme Switching
- [ ] Theme toggle in the page header changes the surface/background feel.
- [ ] Refresh preserves selected theme.
- [ ] `appSettings` table contains the `theme` key.
- [ ] Text contrast remains readable in both themes.

## Responsive Layout
- [ ] Mobile viewport shows bottom navigation.
- [ ] Mobile viewport hides desktop sidebar.
- [ ] Tablet/desktop viewport shows desktop sidebar.
- [ ] Tablet/desktop viewport hides bottom navigation.
- [ ] Dashboard cards stack on mobile.
- [ ] Dashboard charts use stable heights.
- [ ] No text overlaps at narrow widths.

## PWA Install
- [ ] `npm run build` completes.
- [ ] `npm run preview` serves production build.
- [ ] Manifest loads from `/manifest.webmanifest`.
- [ ] PNG icons load from `/pwa-192x192.png` and `/pwa-512x512.png`.
- [ ] Service worker registers.
- [ ] Browser install prompt is available.
- [ ] App shell reloads while offline after first load.

## Local Persistence
- [ ] IndexedDB database `planner_keuangan` is created.
- [ ] Default categories are seeded once.
- [ ] Default subcategories are seeded once.
- [ ] Theme setting persists in `appSettings`.
- [ ] Demo dataset generator can create generalized sample data without private rows.

## Navigation
- [ ] Sidebar route buttons navigate on desktop.
- [ ] Bottom navigation buttons navigate on mobile.
- [ ] Browser back/forward works.
- [ ] Unknown path falls back to dashboard.
- [ ] Active route state is visually clear.

## Reusable UI Components
- [ ] `Button` variants render correctly.
- [ ] `Card` title/action layout is stable.
- [ ] `Modal` opens as a mobile sheet and desktop dialog.
- [ ] Form controls meet touch target requirements.
- [ ] `ProgressBar` exposes progressbar semantics.
- [ ] `ChartCard` provides summary space around charts.

