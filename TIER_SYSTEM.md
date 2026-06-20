# Uang Planner Commercial Tier System

## Philosophy
The app remains privacy-first and offline-first. Commercial tiers unlock depth, automation, planning tools, and premium reporting without deleting or hiding the user's local data. If a license expires later, the app should pause premium actions and keep all existing local records readable.

## Tiers

### BASIC
Designed for personal tracking and simple budgeting.

- Transaction tracker
- Basic dashboard
- Monthly budgeting
- Simple analytics
- 1 account

### PRO
Designed for serious household budgeting and financial planning habits.

- All BASIC features
- Advanced analytics
- Savings goals
- Debt tracker
- Recurring transactions
- Export features
- Advanced charts
- Net worth tracking
- Multi-account
- Smart insights

### ELITE
Designed for premium planning, projections, and advanced financial intelligence.

- All PRO features
- Advanced forecasting
- Financial planning
- Investment tracker
- Retirement simulation
- Advanced insight engine
- Premium reports
- Advanced financial scoring
- Advanced projections

## Centralized Feature Gate
All tier checks must use the centralized capability module, not ad hoc string checks in feature pages.

```ts
type CommercialTier = "basic" | "pro" | "elite";

type FeatureKey =
  | "transaction_tracker"
  | "basic_dashboard"
  | "monthly_budgeting"
  | "simple_analytics"
  | "advanced_analytics"
  | "savings_goals"
  | "debt_tracker"
  | "recurring_transactions"
  | "export_features"
  | "advanced_charts"
  | "net_worth_tracking"
  | "multi_account"
  | "smart_insights"
  | "advanced_forecasting"
  | "financial_planning"
  | "investment_tracker"
  | "retirement_simulation"
  | "advanced_insight_engine"
  | "premium_reports"
  | "advanced_financial_scoring"
  | "advanced_projections";
```

The capability module owns:
- tier hierarchy
- feature availability
- limits such as account count
- upgrade copy
- future license metadata hooks

## Unlock System
Unlocks should be scalable and license-ready:

```ts
type Entitlement = {
  key: FeatureKey;
  tier: CommercialTier;
  enabled: boolean;
  source: "local" | "license" | "trial" | "admin";
  expiresAt?: string;
};
```

Implementation rules:
- Store the selected local tier in Dexie `appSettings`.
- Keep feature checks pure and synchronous in UI after boot.
- Use one helper for feature checks: `canUseFeature(tier, featureKey)`.
- Use one helper for numeric limits: `getTierLimit(tier, limitKey)`.
- Use reusable locked-state UI instead of scattered upsell markup.
- Do not delete existing local data when a user changes tier.

## Current Feature Mapping

| Feature | BASIC | PRO | ELITE |
| --- | --- | --- | --- |
| Transaction tracker | yes | yes | yes |
| Basic dashboard | yes | yes | yes |
| Monthly budgeting | yes | yes | yes |
| Simple analytics | yes | yes | yes |
| Account limit | 1 | unlimited | unlimited |
| Advanced analytics | no | yes | yes |
| Savings goals | no | yes | yes |
| Debt tracker | no | yes | yes |
| Recurring transactions | no | yes | yes |
| Export features | no | yes | yes |
| Advanced charts | no | yes | yes |
| Net worth tracking | no | yes | yes |
| Smart insights | no | yes | yes |
| Advanced forecasting | no | no | yes |
| Financial planning | no | no | yes |
| Investment tracker | no | no | yes |
| Retirement simulation | no | no | yes |
| Advanced insight engine | no | no | yes |
| Premium reports | no | no | yes |
| Advanced financial scoring | no | no | yes |
| Advanced projections | no | no | yes |

## UX Rules
- Locked features should explain what is locked and which tier unlocks it.
- Avoid aggressive upsell language.
- Keep feature cards useful: show what the feature does, not only a lock.
- If a feature is locked, do not perform the premium write/action.
- Existing data stays visible whenever possible.

## Future Licensing Support
The local tier selector is a development/license placeholder. Future license integration can replace the tier source while keeping the same feature gate API.

Future license metadata can include:
- license id
- customer id
- source
- signed entitlement payload
- expiration date
- offline grace period
- last verified date

The UI should read entitlement state through the same capability layer so backend licensing does not leak into product features.

