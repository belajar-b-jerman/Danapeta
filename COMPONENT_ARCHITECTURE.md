# Planner Keuangan Component Architecture

## Goals
- Reusable mobile-first components.
- Clear separation between UI primitives, finance domain components, and page composition.
- Recharts and Framer Motion wrapped behind app-level components so visual behavior stays consistent.
- Future sync and tier gates should not leak into every component.

## Folder Structure

```txt
src/
  app/
    App.tsx
    routes.tsx
    providers.tsx
  components/
    ui/
      Button.tsx
      Card.tsx
      Sheet.tsx
      SegmentedControl.tsx
      Stat.tsx
      ProgressBar.tsx
    charts/
      CategoryDonut.tsx
      SpendingTrend.tsx
      BudgetVarianceChart.tsx
    finance/
      Amount.tsx
      BudgetProgress.tsx
      CategoryBadge.tsx
      BehaviorBadge.tsx
      InsightCard.tsx
      TransactionItem.tsx
      QuickTransactionForm.tsx
    layout/
      AppShell.tsx
      BottomNav.tsx
      DesktopSidebar.tsx
      PageHeader.tsx
  db/
    client.ts
    schema.ts
    repositories/
  features/
    dashboard/
    transactions/
    budgets/
    goals/
    insights/
    settings/
  lib/
    dates.ts
    money.ts
    ids.ts
    privacy.ts
  stores/
    appStore.ts
    filterStore.ts
    plannerStore.ts
  styles/
    globals.css
```

## Component Layers

### UI Primitives
Low-level presentational pieces with no finance knowledge. They accept accessible labels, support touch targets, and use Tailwind variants.

### Finance Components
Reusable domain components such as amount formatting, category badges, budget progress, transaction rows, and insight cards.
Behavior badges should distinguish fixed, variable, planned, impulse, and mandatory spending without making the UI judgmental.

### Feature Components
Screen-specific composition and workflows. These can access repositories, stores, and route state.

### Layout Components
Navigation, responsive shell, safe-area spacing, and page transitions.

## Data Flow
- Pages call feature hooks or repositories.
- Repositories talk to Dexie.
- Zustand stores hold UI/session state and lightweight derived preferences.
- Components receive typed props and avoid direct database access unless they are feature-level containers.

## Interaction Patterns
- Use bottom sheets for mobile create/edit flows.
- Use optimistic local writes because Dexie is the source of truth.
- Use skeletons only when local queries need time; prefer instant cached summaries.
- Use haptic-friendly button sizing and avoid cramped table layouts on mobile.

## Chart Rules
- Wrap Recharts components in reusable chart shells.
- Always provide text summary near a chart.
- Use semantic pastel colors from design tokens.
- Avoid tiny legends on mobile; use inline labels or list summaries.
