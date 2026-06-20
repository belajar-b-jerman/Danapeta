# Uang Planner

Uang Planner is a premium offline-first finance planner PWA for privacy-conscious personal and household budgeting. The app is designed to work locally by default with IndexedDB persistence, installable PWA behavior, mobile-first navigation, and a future-ready sync model.

The current build is a Phase 1 foundation. It intentionally focuses on scalable architecture, shell, routing, local persistence, reusable UI primitives, and dashboard composition rather than advanced finance workflows.

## Tech Stack
- TypeScript
- React 19
- Vite
- Tailwind CSS
- Zustand
- Dexie + IndexedDB
- Vite PWA / Workbox
- Recharts
- Framer Motion
- lucide-react

## Architecture Summary
- `src/app`: app providers, internal router, route registry, root app composition.
- `src/components/layout`: responsive app shell, desktop sidebar, mobile bottom nav, page header.
- `src/components/ui`: reusable primitives such as button, card, modal, form controls, progress bar, segmented control, and stat display.
- `src/components/finance`: finance-oriented reusable components such as amount, transaction row, budget progress, category badge, behavior badge, and insight card.
- `src/components/charts`: reusable chart wrappers and dashboard chart components.
- `src/db`: Dexie client, typed schema, and repositories.
- `src/features`: feature-level page composition. Currently includes dashboard foundation.
- `src/lib`: shared utilities for money, dates, ids, class names, category taxonomy, and demo data.
- `src/stores`: Zustand stores for app shell state and filters.

## Folder Structure
```txt
src/
  app/
  components/
    charts/
    finance/
    layout/
    ui/
  db/
    repositories/
  features/
    dashboard/
  lib/
  stores/
  styles/
public/
```

## Completed Phase
Phase 1 foundation is complete:
- TypeScript/Vite/Tailwind project scaffold.
- PWA manifest, icons, and Vite PWA configuration.
- Dexie local database schema.
- Zustand app/filter stores.
- Local theme persistence through IndexedDB app settings.
- Internal routing without an added router dependency.
- Responsive app shell with sidebar and mobile bottom navigation.
- Dashboard layout using reusable cards and chart wrappers.
- Reusable UI, finance, layout, and chart primitives.
- Generalized category taxonomy and demo dataset generator.
- Opt-in demo data repository for local validation with generalized, non-private patterns.

## Next Development Phases
- Phase 1 continuation: transaction CRUD, category management, budget CRUD, account management, and local backup/export.
- Phase 2: goals, recurring transactions, planned spending envelopes, food run-rate planner, and fixed commitment view.
- Phase 3: richer analytics, anomaly detection, routine/non-routine analysis, subscription detection, and insight history.
- Phase 4: optional encrypted cloud sync, device pairing, conflict resolution, and shared workspaces.

## PWA Overview
The app is configured as an installable PWA with:
- `public/manifest.webmanifest`
- maskable PNG app icons
- SVG icon fallback
- Vite PWA auto-update registration
- Workbox static asset caching
- offline navigation fallback to `index.html`

## Offline-First Approach
IndexedDB is the source of truth for durable local data. Dexie tables store accounts, categories, subcategories, transactions, budgets, goals, recurring rules, insights, import batches, and app settings. Entities include local-first sync metadata so a future cloud layer can be added without reshaping the data model.

## Tier System Overview
The planned tier model keeps local planning useful by default:
- Local Free: offline app, core dashboard, local data, CSV import, backup/export.
- Local Plus: advanced analytics, templates, recurring automation, exports, customization.
- Sync Premium: encrypted backup, multi-device sync, conflict resolution.
- Family: shared household budgeting and roles.

No tier should block access to the user's local data.

## Insight Engine Overview
The insight engine is designed to run locally on computed aggregates, not raw private rows. Planned rules include budget limit warnings, category spikes, recurring candidates, daily meal run-rate, impulse frequency drift, fixed commitment load, and planned expense envelope suggestions.
