# Planner Keuangan Design System

## Design Direction
Planner Keuangan should feel like a premium modern finance dashboard: polished, quiet, optimistic, and trustworthy. The visual language is mobile-first, touch-friendly, and information-rich without becoming crowded.

## Visual Personality
- Elegant pastel aesthetic with restrained contrast.
- Minimal surfaces with soft depth, not heavy glass effects.
- Calm financial confidence rather than playful banking.
- Clear hierarchy for numbers, budgets, alerts, and actions.

## Color Tokens
Use semantic Tailwind tokens so charts, status states, and themes can evolve without rewriting components.

| Token | Use | Value |
| --- | --- | --- |
| `bg.canvas` | App background | `#F7F8F5` |
| `bg.surface` | Primary panels | `#FFFFFF` |
| `bg.muted` | Secondary bands | `#EEF4F1` |
| `text.primary` | Main text | `#1F2933` |
| `text.secondary` | Supporting text | `#6B7280` |
| `brand.sage` | Primary brand | `#88B99A` |
| `brand.mint` | Positive accents | `#A8DDB5` |
| `brand.sky` | Informational accents | `#A9CFEF` |
| `brand.lavender` | Planning accents | `#C8B8EA` |
| `brand.peach` | Warm accents | `#F3B89A` |
| `status.danger` | Overspend/risk | `#D97070` |
| `status.warning` | Watch state | `#D99E45` |
| `status.success` | Healthy state | `#4F9D69` |

## Typography
- Font stack: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif.
- Use tabular numbers for balances and charts.
- Avoid oversized headings inside dashboards. Reserve display type for first-run onboarding only.

| Role | Size | Weight | Notes |
| --- | --- | --- | --- |
| Page title | 24/32 | 700 | Mobile-first page labels |
| Section title | 18/26 | 650 | Dashboard modules |
| Card label | 13/18 | 500 | Muted metadata |
| Body | 15/22 | 400 | Primary copy |
| Metric | 28/36 | 750 | Balances and totals |
| Small metric | 20/28 | 700 | Budget figures |

## Spacing
- Base grid: 4 px.
- Screen padding: 16 px mobile, 24 px tablet, 32 px desktop.
- Component gap: 12 px compact, 16 px default, 24 px section.
- Touch target: minimum 44 x 44 px.

## Radius And Shadow
- Radius: 8 px for cards and controls unless a component needs a circular icon button.
- Shadow: low-opacity, soft vertical elevation only for modals, sheets, and sticky bars.
- Avoid nested cards. Use section bands or unframed layouts for major page structure.

## Components
- Bottom navigation for mobile, sidebar for desktop.
- Icon buttons use lucide-react.
- Segmented controls for time ranges.
- Drawers/sheets for transaction entry and editing.
- Progress bars for budgets and goals.
- Recharts for visual analytics with shared color scales.
- Framer Motion for route transitions, sheet entrance, and small state changes.

## Motion
- Duration: 160 ms for controls, 220 ms for sheets, 280 ms for page transitions.
- Easing: `easeOut` for entry, `easeInOut` for layout transitions.
- Motion should clarify state changes, never slow down data entry.

## Accessibility
- Color is never the only signal for budget state.
- All icon-only controls need accessible labels.
- Respect reduced motion.
- Charts need adjacent summaries for key values.
- Inputs use visible labels and mobile-optimized keyboards.

