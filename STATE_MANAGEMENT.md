# Planner Keuangan State Management

## State Strategy
Use Dexie as durable local source of truth and Zustand for ephemeral UI state, filters, preferences, and lightweight derived state.

## What Belongs In Dexie
- Accounts.
- Categories and subcategories.
- Transactions.
- Budgets.
- Goals.
- Recurring rules.
- Insights.
- Import batches.
- Durable app settings.

## What Belongs In Zustand
- Active route/sidebar state.
- Current period.
- Dashboard filter selection.
- Transaction list search/filter state.
- Behavior and frequency filters for fixed, variable, planned, impulse, mandatory, routine, and non-routine spending.
- Sheet/modal visibility.
- Install prompt state.
- Toast queue.
- Theme preference cache.
- Feature entitlement cache.

## Store Structure

```ts
type AppStore = {
  activePeriod: string;
  isNavOpen: boolean;
  installPromptAvailable: boolean;
  setActivePeriod: (period: string) => void;
  setNavOpen: (value: boolean) => void;
};

type FilterStore = {
  transactionSearch: string;
  accountIds: string[];
  categoryIds: string[];
  setTransactionSearch: (value: string) => void;
  resetTransactionFilters: () => void;
};
```

## Query Pattern
- Feature hooks read Dexie through repositories.
- Hooks expose loading, data, error, and actions.
- Actions write through repositories and then refresh local queries.
- Keep derived calculations in pure utility functions so they can be tested.

## Offline Behavior
- Writes complete locally first.
- Entities receive `syncStatus: "local"` or `"pending"` depending on whether future sync is enabled.
- Conflict state exists in the model but is not surfaced until sync ships.
- Export/backup is available from local database state.

## Performance
- Index transaction queries by date, account, category, and compound period lookups.
- Cache aggregate dashboard summaries for current period where useful.
- Recompute insight aggregates on write or when opening the Insights screen.
- Avoid storing large raw file payloads in Zustand.

## Testing Approach
- Unit test pure money/date/aggregate utilities.
- Integration test repositories with fake-indexeddb.
- Component test critical forms and dashboard summaries.
- E2E test offline startup, add transaction, budget progress, and export.
