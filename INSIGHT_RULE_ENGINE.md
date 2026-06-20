# Planner Keuangan Insight Rule Engine

## Purpose
The insight engine turns local finance data into deterministic, explainable, human-readable guidance. It runs entirely on-device, uses local aggregates, and never calls an AI API or sends raw transaction data to a network service.

The system is designed for premium finance UX: concise insight cards, visible evidence, clear priority, and action routes that help the user improve cashflow, budget quality, debt load, savings consistency, and long-term stability.

## Architecture

### Deterministic Engine
Each rule is a pure function over a normalized local context. Given the same Dexie data and period, the engine returns the same insights, score, priority, and recommendations.

```ts
type InsightRule = {
  id: string;
  category: InsightCategory;
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  evaluate: (context: InsightContext) => InsightDraft[];
};
```

### Modular Rule System
Rules live in a registry and can be added without changing the engine runner:
- `financialHealthScoreRule`
- `budgetRiskRule`
- `categorySpikeRule`
- `cashflowRunwayRule`
- `savingsRateRule`
- `debtRatioRule`
- `emergencyFundRule`
- `recurringCommitmentRule`
- `subscriptionDetectionRule`
- `lifestyleInflationRule`
- `positiveAchievementRule`

Future expansion should add new rules to the registry and keep calculation helpers pure.

### Insight Feed
The feed is a ranked list persisted to the local `insights` table. It supports:
- new, seen, dismissed, and pinned statuses
- severity labels
- priority score
- category filtering in UI
- evidence rows
- recommended action labels and local routes

The current schema stores category and priority inside `evidence` when needed, so no DB migration is required for MVP.

## Insight Categories
- spending behavior
- overspending
- savings health
- debt health
- budgeting quality
- cashflow health
- subscription detection
- recurring expense analysis
- emergency fund readiness
- lifestyle inflation
- income dependency
- financial stability
- investment allocation
- spending anomaly
- habit trends
- positive achievements
- financial warnings
- recommendations
- future cashflow prediction

## Financial Principles Referenced
Rules should stay explainable and grounded in broad personal finance planning principles:
- CFP-style cashflow planning: maintain positive monthly cashflow and adequate liquidity.
- Budgeting best practice: separate fixed, variable, mandatory, planned, and impulse spending.
- Emergency fund standards: compare liquid reserves against monthly expenses and target 3-6 months where practical.
- Debt ratio standards: flag high consumer debt burden and praise debt payoff progress.
- Savings rate standards: monitor savings rate and encourage consistency.
- Cashflow management standards: estimate runway, upcoming recurring commitments, and budget exhaustion before month end.
- Personal finance frameworks: use category envelopes, sinking funds for planned irregular expenses, and guardrails for lifestyle inflation.

## Financial Health Scoring
Health score is a deterministic 0-100 score from local aggregates:

| Area | Max Points | Logic |
| --- | ---: | --- |
| Cashflow health | 20 | Positive cashflow, expense/income ratio, future cashflow forecast |
| Savings health | 20 | Savings rate and contribution consistency |
| Budget quality | 20 | Budget coverage, budget risk, rollover discipline |
| Debt health | 15 | Debt ratio and debt payoff progress |
| Emergency readiness | 15 | Runway months from liquid balances |
| Stability signals | 10 | Income dependency, recurring load, anomaly count |

Scores are interpreted as:
- 80-100: strong
- 65-79: stable
- 50-64: needs attention
- below 50: high risk

## Priority System
Every insight receives a numeric priority score:

```txt
priorityScore =
  severityWeight
  + categoryWeight
  + confidenceWeight
  + recencyWeight
  + actionabilityWeight
```

Severity weights:
- critical: 80
- warning: 60
- info: 35
- positive: 25

Category weights:
- cashflow health, financial warnings, debt health: +15
- emergency fund readiness, overspending, budget quality: +12
- savings health, recurring expense analysis, subscription detection: +10
- positive achievements: +5

Tie-breakers:
- pinned insights rank first
- critical and warning rank before info
- insights with direct actions rank above passive observations
- dismissed insights stay persisted but are hidden from the default feed

## Recommendation Framework
Recommendations should be:
- specific: name the affected finance area
- explainable: show numbers in evidence
- local: route to Budget, Goals, Transactions, or Insight detail
- neutral: avoid shame, especially around food, health, family, or mandatory spending
- practical: propose the next small action

Example action shapes:

```ts
{ label: "Review budget", route: "/budgets" }
{ label: "Add contribution", route: "/goals" }
{ label: "Filter transactions", route: "/transactions" }
```

## Engine Flow
1. Load local transactions, accounts, categories, budgets, goals, recurring rules, and app settings.
2. Build normalized aggregates:
   - monthly income and expense
   - category totals and rolling averages
   - budget spent versus limit
   - behavior mix
   - recurring commitment load
   - goal progress
   - debt balances
   - emergency runway months
3. Evaluate every enabled rule in the registry.
4. Attach evidence, category, score, and action.
5. Deduplicate by `ruleId`, `period`, and affected entity.
6. Rank using the priority system.
7. Persist generated insights in Dexie.
8. Render feed from persisted insights, excluding dismissed cards by default.

## MVP Rules

### Financial Health Score
Produces one summary insight with score, rating, and top drivers.

### Budget Risk Warning
Triggers when a budget is projected to exhaust before month end or is already above warning threshold.

### Overspending Alert
Triggers when monthly expense exceeds income or category spend exceeds planned budget.

### Spending Spike
Triggers when a category is at least 35% above a rolling 3-month average and above a minimum amount threshold.

### Savings Health
Evaluates savings rate:
- strong: at least 20%
- stable: 10-19%
- warning: below 10%
- critical: negative savings rate

### Debt Health
Evaluates credit/debt balances against net worth or income. Praises debt reduction when current debt is lower than previous periods.

### Emergency Fund Readiness
Estimates runway months as liquid balances divided by average monthly expense. Flags below 1 month, watches below 3 months, praises at or above 3 months.

### Recurring Expense Analysis
Compares recurring templates against income and flags high fixed commitment load.

### Subscription Detection
Finds repeated merchant/category patterns with similar amounts and monthly cadence. It suggests recurring review, not automatic classification.

### Lifestyle Inflation
Flags discretionary categories growing faster than income over comparable periods.

### Future Cashflow Prediction
Projects end-of-month expense using day-of-month run rate and recurring commitments.

### Runway Estimation
Estimates how many months current liquid balances can cover current expense pace.

### Budget Exhaustion Prediction
Estimates the date a budget will hit its limit based on current run rate.

### Positive Achievements
Praises savings consistency, reduced discretionary spending, debt payoff progress, and budgets staying healthy.

## Privacy Rules
- No AI API.
- No remote calls.
- No telemetry.
- Do not embed imported private rows in source.
- Use aggregate totals, counts, category labels, and user-visible labels.
- Merchant names may be used only when already visible to the user and only for local subscription or recurring detection.

