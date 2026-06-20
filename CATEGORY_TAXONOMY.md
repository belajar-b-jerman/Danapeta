# Planner Keuangan Category Taxonomy

## Source Use
This taxonomy is generalized from the attached spending export. It captures category structure, spending behavior, and budgeting patterns without storing raw transaction rows, exact private descriptions, or personal amounts.

## Planning Dimensions
Planner Keuangan should separate transaction direction from spending behavior.

Transaction direction:
- `income`
- `expense`
- `transfer`

Spending behavior:
- `fixed`: recurring commitments with predictable amount or due date.
- `variable`: routine spending with flexible amount.
- `planned`: intentional non-routine spending that should be budgeted ahead.
- `impulse`: discretionary unplanned spending.
- `mandatory`: necessary spending that may be irregular but should not be treated as lifestyle leakage.

Frequency:
- `routine`
- `non_routine`

These dimensions should power filters, budget recommendations, and insight rules.

## Default Expense Categories

| Category | Purpose | Common Behavior | Suggested Subcategories |
| --- | --- | --- | --- |
| Makan | Daily meals, snacks, drinks, and cooking ingredients | `variable`, `impulse` | Sarapan, Makan Siang, Makan Malam, Jajan, Kopi, Bahan Masak, Buah |
| Transportasi | Mobility and vehicle-related daily costs | `variable` | Bensin Mobil, Bensin Motor, Parkir, Transport Online, Tol |
| Rumah Tangga | Home supplies and maintenance | `variable`, `fixed` | Perlengkapan, Peralatan, Maintenance, Kebersihan |
| Tagihan | Utility and connectivity bills | `fixed` | Listrik, Air, Internet, Pulsa/Data |
| Anak & Pendidikan | School and child-related needs | `fixed`, `planned`, `mandatory` | SPP, Kegiatan Sekolah, Iuran Sekolah, Perlengkapan Anak, Acara Anak |
| Keluarga | Household/family support and family events | `fixed`, `planned`, `variable` | Bulanan Keluarga, Kebutuhan Keluarga, Acara Keluarga |
| Kesehatan | Medicine and health needs | `mandatory`, `variable` | Obat, Konsultasi, Vitamin, Perawatan |
| Lifestyle | Fashion, travel, recreation, and personal wants | `variable`, `planned`, `impulse` | Fashion, Liburan, Hiburan, Self-Care |
| Supermarket | Grocery and stock-up shopping | `variable` | Belanja Bulanan, Bahan Pokok, Kebutuhan Dapur |
| Perumahan | Housing dues and residential costs | `fixed`, `variable` | Iuran Lingkungan, Perbaikan Rumah, Sewa/Cicilan |
| Sosial & Keagamaan | Giving and community obligations | `variable`, `planned` | Donasi, Iuran Sosial, Keagamaan |
| Kerja | Work-related operational costs | `variable` | Perlengkapan Kerja, Makan Kerja, Transport Kerja |

## Budgeting Flows
- Start with routine categories first: meals, transport, household, bills, and child/education needs.
- Split food budgets into daily meal envelopes and impulse envelopes because the spending behavior differs.
- Treat fixed bills as monthly commitments with due-date reminders.
- Treat planned events as sinking funds so they do not distort regular monthly budgets.
- Keep mandatory health expenses visible but avoid negative wording when they exceed historical averages.
- Use supermarket and cooking ingredients to help users understand the tradeoff between stocked groceries and daily meal purchases.

## Analytics Assumptions
- Food is likely high-frequency and should be analyzed by frequency, subcategory, and day/week rhythm.
- Routine spending should be measured against monthly run rate.
- Non-routine planned spending should be compared with planned envelopes, not ordinary variable budgets.
- Impulse spending should be tracked by count and small recurring leakage, not only total amount.
- Fixed expenses should be surfaced as commitments before calculating flexible remaining budget.

## Privacy Guardrails
- Merchant names from imports are user data, not taxonomy.
- Notes and descriptions must never seed default category labels automatically without user confirmation.
- Category suggestions can be generated from aggregate frequencies and user-approved labels.
- Documentation and source code should use generic examples only.
