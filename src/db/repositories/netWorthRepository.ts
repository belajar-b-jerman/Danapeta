import { createId } from "../../lib/ids";
import { db } from "../client";
import type { Asset, Liability } from "../schema";

type CreateAssetInput = Omit<Asset, "id" | "createdAt" | "updatedAt" | "syncStatus" | "version" | "isArchived">;
type UpdateAssetInput = Partial<Omit<Asset, "id" | "createdAt" | "syncStatus" | "version">>;
type CreateLiabilityInput = Omit<Liability, "id" | "createdAt" | "updatedAt" | "syncStatus" | "version" | "isArchived">;
type UpdateLiabilityInput = Partial<Omit<Liability, "id" | "createdAt" | "syncStatus" | "version">>;

export async function listAssets(includeArchived = false) {
  const assets = await db.assets.toArray();
  return assets.filter((asset) => includeArchived || !asset.isArchived);
}

export async function listLiabilities(includeArchived = false) {
  const liabilities = await db.liabilities.toArray();
  return liabilities.filter((liability) => includeArchived || !liability.isArchived);
}

export async function createAsset(input: CreateAssetInput) {
  const now = new Date().toISOString();
  const asset: Asset = {
    ...input,
    id: createId("asset"),
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1,
    isArchived: false
  };
  await db.assets.add(asset);
  return asset;
}

export async function updateAsset(id: string, input: UpdateAssetInput) {
  const existing = await db.assets.get(id);
  if (!existing || existing.deletedAt) return undefined;
  await db.assets.update(id, {
    ...input,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: existing.version + 1
  });
  return db.assets.get(id);
}

export async function archiveAsset(id: string) {
  return updateAsset(id, { isArchived: true });
}

export async function createLiability(input: CreateLiabilityInput) {
  const now = new Date().toISOString();
  const liability: Liability = {
    ...input,
    id: createId("liability"),
    currentBalance: Math.abs(input.currentBalance),
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1,
    isArchived: false
  };
  await db.liabilities.add(liability);
  return liability;
}

export async function updateLiability(id: string, input: UpdateLiabilityInput) {
  const existing = await db.liabilities.get(id);
  if (!existing || existing.deletedAt) return undefined;
  await db.liabilities.update(id, {
    ...input,
    currentBalance: input.currentBalance === undefined ? existing.currentBalance : Math.abs(input.currentBalance),
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: existing.version + 1
  });
  return db.liabilities.get(id);
}

export async function archiveLiability(id: string) {
  return updateLiability(id, { isArchived: true });
}
