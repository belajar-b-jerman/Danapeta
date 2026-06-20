# Planner Keuangan Database Schema

## Storage Model
Planner Keuangan uses Dexie over IndexedDB. The schema is local-first and includes sync metadata for a future optional cloud layer.

## Shared Fields
Every persisted entity should include:

```ts
type EntityMeta = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  syncStatus: "local" | "pending" | "synced" | "conflict";
  remoteId?: string;
  version: number;
};
```

## Tables

### `accounts`
Represents cash, bank, e-wallet, credit card, or manual account buckets.

Indexes:
- `id`
- `type`
- `isArchived`
- `syncStatus`

Fields:
- `name`
- `type`: `cash | bank | ewallet | credit | savings | investment | other`
- `currency`: default `IDR`
- `openingBalance`
- `currentBalance`
- `color`
- `icon`
- `isArchived`

### `categories`
Top-level finance groupings inferred from user behavior and editable by the user.

Indexes:
- `id`
- `kind`
- `sortOrder`
- `isSystem`

Fields:
- `name`
- `kind`: `income | expense | transfer`
- `defaultBehavior?`: `fixed | variable | planned | impulse | mandatory`
- `budgetGroup?`: `daily | commitment | sinking_fund | flexible | giving | work`
- `color`
- `icon`
- `sortOrder`
- `isSystem`
- `isArchived`

### `subcategories`
More precise labels under a category.

Indexes:
- `id`
- `categoryId`
- `[categoryId+name]`

Fields:
- `categoryId`
- `name`
- `defaultBehavior?`: `fixed | variable | planned | impulse | mandatory`
- `sortOrder`
- `isSystem`
- `isArchived`

### `transactions`
Atomic financial events.

Indexes:
- `id`
- `date`
- `accountId`
- `categoryId`
- `subcategoryId`
- `type`
- `merchant`
- `amount`
- `behavior`
- `frequency`
- `[date+categoryId]`
- `[accountId+date]`

Fields:
- `type`: `income | expense | transfer`
- `accountId`
- `transferAccountId?`
- `categoryId`
- `subcategoryId?`
- `amount`
- `currency`
- `date`
- `merchant?`
- `note?`
- `tags`
- `behavior?`: `fixed | variable | planned | impulse | mandatory`
- `frequency?`: `routine | non_routine`
- `source`: `manual | import | recurring | adjustment`
- `importBatchId?`
- `attachmentIds?`

### `budgets`
Budget envelope for a category or subcategory over a period.

Indexes:
- `id`
- `period`
- `categoryId`
- `subcategoryId`
- `[period+categoryId]`

Fields:
- `name`
- `period`: `YYYY-MM`
- `categoryId`
- `subcategoryId?`
- `limitAmount`
- `spentAmountSnapshot?`
- `rolloverEnabled`
- `rolloverAmount`
- `alertThresholds`: number[]

### `goals`
Savings or debt payoff targets.

Indexes:
- `id`
- `status`
- `targetDate`

Fields:
- `name`
- `type`: `savings | debt_payoff | emergency_fund | custom`
- `targetAmount`
- `currentAmount`
- `targetDate?`
- `linkedAccountId?`
- `monthlyContribution?`
- `status`: `active | paused | completed | archived`

### `recurringRules`
Recurring transaction templates.

Indexes:
- `id`
- `nextRunAt`
- `status`

Fields:
- `name`
- `transactionTemplate`
- `frequency`: `daily | weekly | monthly | yearly`
- `interval`
- `nextRunAt`
- `lastRunAt?`
- `status`: `active | paused | ended`

### `insights`
Locally generated insight cards.

Indexes:
- `id`
- `period`
- `severity`
- `status`

Fields:
- `period`
- `ruleId`
- `title`
- `body`
- `severity`: `info | positive | warning | critical`
- `evidence`
- `action`
- `status`: `new | seen | dismissed | pinned`

### `importBatches`
Tracks CSV imports without storing source files in code.

Indexes:
- `id`
- `createdAt`
- `status`

Fields:
- `fileName`
- `rowCount`
- `mappedColumns`
- `status`: `draft | imported | failed | reverted`
- `summary`

### `appSettings`
Small key-value preferences.

Indexes:
- `key`

Fields:
- `key`
- `value`
- `updatedAt`

## Schema Versioning
- Version 1: MVP local tables.
- Version 2: attachments and richer import mappings.
- Version 3: optional sync cursors and encrypted backup metadata.

## Default Taxonomy
Use a seed taxonomy based on generalized spending patterns, not private rows:
- Makan: Sarapan, Makan Siang, Makan Malam, Jajan, Kopi, Bahan Masak, Buah.
- Transportasi: Bensin Mobil, Bensin Motor, Parkir, Transport Online, Tol.
- Rumah Tangga: Perlengkapan, Peralatan, Maintenance, Kebersihan.
- Tagihan: Listrik, Air, Internet, Pulsa/Data.
- Anak & Pendidikan: SPP, Kegiatan Sekolah, Iuran Sekolah, Perlengkapan Anak, Acara Anak.
- Keluarga: Bulanan Keluarga, Kebutuhan Keluarga, Acara Keluarga.
- Kesehatan: Obat, Konsultasi, Vitamin, Perawatan.
- Lifestyle: Fashion, Liburan, Hiburan, Self-Care.
- Supermarket: Belanja Bulanan, Bahan Pokok, Kebutuhan Dapur.
- Perumahan: Iuran Lingkungan, Perbaikan Rumah, Sewa/Cicilan.
- Sosial & Keagamaan: Donasi, Iuran Sosial, Keagamaan.
- Kerja: Perlengkapan Kerja, Makan Kerja, Transport Kerja.
