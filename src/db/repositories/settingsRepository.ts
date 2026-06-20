import { db } from "../client";

export async function setAppSetting(key: string, value: unknown) {
  await db.appSettings.put({
    key,
    value,
    updatedAt: new Date().toISOString()
  });
}

export async function getAppSetting<T>(key: string) {
  const setting = await db.appSettings.get(key);
  return setting?.value as T | undefined;
}

