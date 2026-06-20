# Project Context

## Product
Uang Planner is a privacy-first, offline-first finance planner PWA. The product is based on the Planner Keuangan master specs and is tuned for Indonesian household budgeting patterns. The attached CSV reference was used only for generalized taxonomy and spending patterns.

## Current Architecture Decisions
- Use React + Vite for a fast PWA foundation.
- Use TypeScript throughout.
- Use Tailwind semantic tokens for theming and consistency.
- Use Zustand only for ephemeral UI state, filters, and preferences.
- Use Dexie/IndexedDB as durable local source of truth.
- Keep routing lightweight with an internal router instead of adding React Router during foundation.
- Keep sync metadata on persisted entities from day one.
- Keep demo data generalized and non-private.

## Completed Modules
- PWA manifest and icons in `public/`.
- Vite PWA configuration in `vite.config.ts`.
- App providers and bootstrapping in `src/app/providers.tsx`.
- Internal route registry and router in `src/app/routes.tsx` and `src/app/router.tsx`.
- Responsive layout system in `src/components/layout`.
- UI primitives in `src/components/ui`.
- Finance primitives in `src/components/finance`.
- Chart wrapper and chart components in `src/components/charts`.
- Dashboard foundation in `src/features/dashboard/DashboardPage.tsx`.
- Dexie client and schema in `src/db`.
- Repositories for categories, transactions, and settings.
- Generalized taxonomy in `src/lib/categoryTaxonomy.ts`.
- Generalized demo dataset generator in `src/lib/demoData.ts`.
- Opt-in demo dataset repository in `src/db/repositories/demoRepository.ts`.

## Database Structure Summary
Current Dexie database name: `planner_keuangan`.

Tables:
- `accounts`
- `categories`
- `subcategories`
- `transactions`
- `budgets`
- `goals`
- `recurringRules`
- `insights`
- `importBatches`
- `appSettings`

Every sync-ready entity uses:
- `id`
- `createdAt`
- `updatedAt`
- `deletedAt?`
- `syncStatus`
- `remoteId?`
- `version`

## Dexie Schema Summary
Important indexes:
- categories by `kind`, `sortOrder`, `isSystem`
- subcategories by `categoryId` and `[categoryId+name]`
- transactions by `date`, `accountId`, `categoryId`, `subcategoryId`, `type`, `merchant`, `amount`, `behavior`, `frequency`, `[date+categoryId]`, `[accountId+date]`
- budgets by `period`, `categoryId`, `subcategoryId`, `[period+categoryId]`
- insights by `period`, `severity`, `status`
- app settings by `key`

## Zustand Store Summary
`useAppStore`:
- active period
- navigation state
- theme
- install prompt availability

`useFilterStore`:
- transaction search
- account/category filters
- spending behavior filters
- spending frequency filters

Durable preferences should be written through Dexie `appSettings`, not only Zustand.

## Routing Structure
Routes are defined in `src/app/routes.tsx`.

Current routes:
- `/` dashboard
- `/transactions`
- `/budgets`
- `/goals`
- `/insights`
- `/settings`

The current router uses History API and `popstate`. Add a full routing library only if nested routes, URL params, loaders, or route-level data requirements become complex.

## Design System Rules
- Mobile-first UX.
- 44 px minimum touch target.
- Cards use 8 px radius.
- Avoid nested cards.
- Sidebar on desktop, bottom navigation on mobile.
- Pastel semantic tokens, not one-off color sprawl.
- Charts require nearby text summaries.
- Motion should clarify state changes and stay fast.
- Icon buttons use lucide-react and accessible labels.

## Coding Conventions
- Keep TypeScript strict and explicit.
- Use repositories for Dexie access.
- Use UI primitives before creating page-specific styling.
- Keep feature pages under `src/features`.
- Keep reusable domain display under `src/components/finance`.
- Keep pure utilities under `src/lib`.
- Do not hardcode private CSV rows, merchants, notes, or amounts.
- Prefer generalized sample data only.
- Keep comments sparse and useful.

## Reusable Component Patterns
- `Button`: variants for primary, secondary, ghost, danger.
- `Card`: section wrapper with optional title, eyebrow, and action.
- `Modal`: Framer Motion modal/sheet pattern.
- `Field`, `Input`, `Select`, `FormActions`: reusable form foundation.
- `ProgressBar`: accessible progress primitive.
- `ChartCard`: common chart framing and summary space.
- `Amount`, `CategoryBadge`, `BehaviorBadge`: finance-specific formatting.

## Future Roadmap
- Transaction CRUD with quick mobile entry.
- Account management.
- Category and subcategory management.
- Budget CRUD and budget progress.
- Local backup/export.
- CSV import mapping.
- Local insight rule engine.
- Goals and recurring rules.
- Optional encrypted cloud sync.

## Current Limitations
- No transaction form is wired into the UI yet.
- Dashboard uses generalized placeholder data.
- Demo dataset generator is not wired to a dev-only button.
- Demo dataset seeding is intentionally opt-in through repository code, not automatic on app boot.
- No test runner is configured.
- No full PWA/browser validation has been run in this environment.
- Current internal router is intentionally simple.

## Pending Features
- Transaction CRUD screens.
- Budget CRUD screens.
- Account CRUD screens.
- IndexedDB query hooks.
- CSV import UI.
- Backup/export UI.
- Insight engine implementation.
- Accessibility pass after interactive forms exist.
- E2E validation across mobile/tablet/desktop.

## Instructions For Future Codex Sessions
1. Read the master specs first:
   - `PRD.md`
   - `DESIGN_SYSTEM.md`
   - `DB_SCHEMA.md`
   - `FEATURE_ROADMAP.md`
   - `INSIGHT_RULE_ENGINE.md`
   - `TIER_SYSTEM.md`
   - `COMPONENT_ARCHITECTURE.md`
   - `STATE_MANAGEMENT.md`
   - `API_FUTURE_SYNC.md`
   - `CATEGORY_TAXONOMY.md`
2. Preserve architecture and avoid broad rewrites.
3. Add features through `src/features`, repositories, and reusable components.
4. Keep data local-first and privacy-first.
5. Never expose raw CSV data or private spending descriptions.
6. Validate with `npm run build` and responsive browser checks when Node/npm are available.
