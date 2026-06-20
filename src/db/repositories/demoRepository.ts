import { createDemoDataset } from "../../lib/demoData";
import { db } from "../client";

export async function seedDemoDataset() {
  const existingTransactions = await db.transactions.toArray();
  if (existingTransactions.some((transaction) => transaction.tags.includes("demo"))) return;

  const dataset = createDemoDataset();

  await db.transaction(
    "rw",
    [db.accounts, db.categories, db.subcategories, db.transactions, db.budgets],
    async () => {
      await db.accounts.bulkAdd(dataset.accounts);
      await db.categories.bulkAdd(dataset.categories);
      await db.subcategories.bulkAdd(dataset.subcategories);
      await db.transactions.bulkAdd(dataset.transactions);
      await db.budgets.bulkAdd(dataset.budgets);
    }
  );
}
