# Planner Keuangan Feature Roadmap

## Phase 0: Foundation
- Vite TypeScript PWA scaffold.
- Tailwind design tokens.
- Dexie database and migrations.
- Zustand stores for app shell, filters, and preferences.
- Mobile-first navigation.
- Empty states and demo-safe seed templates.

## Phase 1: Core Planner MVP
- Transaction CRUD.
- Category and subcategory management.
- Default generalized taxonomy for household spending categories and subcategories.
- Behavior labels for fixed, variable, planned, impulse, and mandatory expenses.
- Account management.
- Monthly dashboard.
- Budget CRUD with progress summaries.
- Recent transaction list.
- Recharts category breakdown and monthly trend.
- Local insight rule engine.
- CSV import mapping that learns structure without hardcoding private rows.
- Local backup/export.

## Phase 2: Planning Depth
- Savings goals.
- Recurring transaction rules.
- Calendar view for upcoming bills.
- Budget suggestions from spending patterns.
- Food run-rate planner split by daily meals, groceries, and impulse snacks.
- Fixed commitment view for bills, housing, education, and family support.
- Rollover budgets.
- Merchant cleanup and duplicate detection.
- Advanced search and saved filters.

## Phase 3: Premium Analytics
- Cashflow forecast.
- Category seasonality.
- Routine versus non-routine spending analysis.
- Impulse frequency trend and flexible spending guardrails.
- Subscription detection.
- Anomaly detection from rolling averages.
- Net worth view.
- Goal contribution recommendations.
- Insight history and dismissed insight learning.

## Phase 4: Optional Sync
- User-controlled encrypted cloud sync.
- Device pairing.
- Conflict resolution UI.
- Shared household workspace.
- Cloud backup and restore.

## Phase 5: Ecosystem
- Bank statement parser profiles.
- Template marketplace for budget systems.
- Export to spreadsheet/PDF.
- Local-first AI summaries using redacted aggregates only.
- Plugin-style import adapters.

## Release Principles
- Every phase must remain fully usable offline.
- Sync features must be opt-in and reversible.
- Analytics must explain the data behind recommendations.
- No feature should require storing private spending examples in source code.
