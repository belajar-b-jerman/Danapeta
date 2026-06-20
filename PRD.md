# Planner Keuangan PRD

## Product Vision
Planner Keuangan is a premium, privacy-first, offline-first finance planner for Indonesian users who want calm visibility over spending, budgets, goals, and financial habits without sending private data to a server.

The product behaves like an installable mobile app while remaining a PWA. All core planning, budgeting, and analytics features work locally through IndexedDB. Cloud sync is optional and future-ready, never required for the product to be useful.

## Target Users
- Salaried professionals managing monthly income, bills, savings, and lifestyle spending.
- Couples or families who want recurring budget routines and shared planning in a future sync tier.
- Freelancers with variable income who need cashflow visibility and category-level insights.
- Privacy-conscious users who prefer financial data to remain on their own device.

## Core Jobs
- Capture income and expenses quickly on mobile.
- Understand where money goes by category, subcategory, merchant, account, and time period.
- Create realistic budgets based on recurring spending patterns.
- Track savings goals and upcoming obligations.
- Receive useful, explainable local insights without exposing private data.
- Export, back up, and later sync data when the user explicitly opts in.

## MVP Scope
- Installable PWA with offline shell and cached static assets.
- Local Dexie database over IndexedDB.
- Transaction CRUD with category, subcategory, account, amount, note, merchant, date, and tags.
- Budget CRUD with monthly period support.
- Dashboard with balance summary, monthly spending, budget progress, recent transactions, and category breakdown.
- Analytics with Recharts for category trend, spending over time, and budget variance.
- Local insight engine that generates deterministic finance tips from local aggregates.
- Zustand stores for UI state, planner filters, and app preferences.
- Import flow that can infer category/subcategory suggestions from CSV structure without storing private examples in source.
- Category taxonomy tuned for common Indonesian household patterns: meals, transport, household, bills, child/education, family, health, lifestyle, supermarket, housing, social/religious, and work.
- Spending behavior labels for fixed, variable, planned, impulse, and mandatory expenses.

## Non-Goals For MVP
- Bank integrations.
- Server account system.
- Real-time collaboration.
- Investment brokerage or tax advice.
- Hardcoded personal spending data.
- AI calls using raw private transaction data.

## Product Principles
- Offline first: the app opens, reads, writes, and analyzes without network access.
- Privacy first: no telemetry or cloud sync by default.
- Mobile first: thumb-friendly navigation, large touch targets, and fast add flows.
- Premium calm: elegant pastel surfaces, clean typography, and dense but breathable information.
- Explainable insights: every recommendation should map back to simple rules and visible numbers.
- Future ready: local entities include sync metadata without forcing cloud behavior today.

## Primary Screens
- Dashboard: monthly overview, cashflow, budget health, category mix, and insights.
- Transactions: searchable ledger with quick add, filters, and edit drawer.
- Budgets: monthly category budgets, progress, rollover-ready fields, and variance.
- Goals: savings targets, contribution plan, progress, and deadline health.
- Insights: grouped recommendations, trend warnings, and recurring spend detection.
- Settings: privacy controls, backup/export, data import, install status, and future sync entry point.

## Success Metrics
- User can add a transaction in under 15 seconds on mobile.
- Dashboard loads from local data in under 500 ms after app shell is ready.
- App remains usable in airplane mode after first load.
- Budget creation can be completed from suggested categories in under 2 minutes.
- Insight recommendations are deterministic, explainable, and never require network access.

## Risks
- IndexedDB quota and browser storage eviction require clear backup/export affordances.
- CSV import formats vary widely and need resilient mapping.
- Finance UIs can become visually noisy; information hierarchy must stay disciplined.
- Future sync must avoid data conflicts and accidental private data upload.

## CSV Reference Findings
The attached export suggests that realistic household planning needs both category and behavior dimensions. Routine variable spending can dominate transaction count, especially around daily meals, while fixed bills, education, housing dues, planned family events, and mandatory health costs need different budgeting treatments.

Planner Keuangan should therefore avoid a single flat expense category model. The product should support:
- Daily/routine envelopes for high-frequency categories.
- Fixed commitment tracking for bills, housing, and education.
- Planned sinking funds for events, travel, and family needs.
- Gentle impulse-spending visibility for snacks, coffee, fashion, and similar discretionary patterns.
