import { createId } from "../../lib/ids";
import { db } from "../client";
import type { Asset } from "../schema";

export type AssetInput = Pick<Asset, "name" | "type" | "currentValue" | "currency" | "liquidity" | "includeInNetWorth"> &
  Partial<Pick<Asset, "category" | "appreciationRate" | "notes" | "linkedAccountId" | "linkedGoalId">>;

export async function listAssets(includeArchived = false) {
  const assets = await db.assets.toArray();
  return assets
    .filter((asset) => !asset.deletedAt)
    .filter((asset) => includeArchived || !asset.isArchived)
    .sort((left, right) => right.currentValue - left.currentValue);
}

export async function createAsset(input: AssetInput) {
  const now = new Date().toISOString();
  const asset: Asset = {
    id: createId("asset"),
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1,
    name: input.name.trim(),
    type: input.type,
    category: input.category,
    currentValue: Math.max(input.currentValue, 0),
    estimatedValue: Math.max(input.currentValue, 0),
    appreciationRate: input.appreciationRate ?? 0,
    notes: input.notes?.trim() || undefined,
    currency: input.currency,
    linkedAccountId: input.linkedAccountId,
    linkedGoalId: input.linkedGoalId,
    liquidity: input.liquidity,
    includeInNetWorth: input.includeInNetWorth,
    isArchived: false
  };

  await db.assets.add(asset);
  return asset;
}

export async function updateAsset(id: string, input: Partial<AssetInput>) {
  const existing = await db.assets.get(id);
  if (!existing || existing.deletedAt) return undefined;

  await db.assets.update(id, {
    ...input,
    name: input.name?.trim() ?? existing.name,
    currentValue: input.currentValue === undefined ? existing.currentValue : Math.max(input.currentValue, 0),
    estimatedValue: input.currentValue === undefined ? existing.estimatedValue : Math.max(input.currentValue, 0),
    notes: input.notes?.trim() || undefined,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: existing.version + 1
  });

  return db.assets.get(id);
}

export async function archiveAsset(id: string) {
  const existing = await db.assets.get(id);
  if (!existing || existing.deletedAt || existing.isArchived) return;
  await db.assets.update(id, {
    isArchived: true,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: existing.version + 1
  });
}
