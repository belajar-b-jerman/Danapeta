import { createPlannerBackup, parsePlannerBackup, type PlannerBackup } from "./dataPortability";

type EncryptedPlannerBackup = {
  app: "danapeta";
  kind: "encrypted-backup";
  version: 1;
  exportedAt: string;
  crypto: {
    algorithm: "AES-GCM";
    kdf: "PBKDF2-SHA-256";
    iterations: number;
    salt: string;
    iv: string;
  };
  payload: string;
};

const iterations = 210000;

export async function createEncryptedPlannerBackup(passphrase: string) {
  const backup = await createPlannerBackup();
  const encrypted = await encryptPlannerBackup(backup, passphrase);
  return {
    backup,
    blob: new Blob([JSON.stringify(encrypted, null, 2)], { type: "application/vnd.danapeta.backup+json;charset=utf-8" })
  };
}

export async function decryptPlannerBackup(raw: string, passphrase: string) {
  const encrypted = parseEncryptedBackup(raw);
  const key = await deriveKey(passphrase, fromBase64(encrypted.crypto.salt), encrypted.crypto.iterations);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(encrypted.crypto.iv) },
      key,
      fromBase64(encrypted.payload)
    );
    return parsePlannerBackup(new TextDecoder().decode(decrypted));
  } catch {
    throw new Error("Backup terenkripsi tidak bisa dibuka. Periksa file atau passphrase.");
  }
}

export function downloadEncryptedBackup(blob: Blob, exportedAt: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `danapeta-backup-encrypted-${exportedAt.slice(0, 10)}.danapeta`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function encryptPlannerBackup(backup: PlannerBackup, passphrase: string): Promise<EncryptedPlannerBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const payload = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(backup))
  );

  return {
    app: "danapeta",
    kind: "encrypted-backup",
    version: 1,
    exportedAt: backup.exportedAt,
    crypto: {
      algorithm: "AES-GCM",
      kdf: "PBKDF2-SHA-256",
      iterations,
      salt: toBase64(salt),
      iv: toBase64(iv)
    },
    payload: toBase64(new Uint8Array(payload))
  };
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterationCount: number) {
  if (passphrase.trim().length < 8) {
    throw new Error("Passphrase minimal 8 karakter.");
  }
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toArrayBuffer(salt), iterations: iterationCount, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function parseEncryptedBackup(raw: string): EncryptedPlannerBackup {
  const parsed = JSON.parse(raw) as EncryptedPlannerBackup;
  if (
    parsed.app !== "danapeta" ||
    parsed.kind !== "encrypted-backup" ||
    parsed.version !== 1 ||
    parsed.crypto?.algorithm !== "AES-GCM" ||
    parsed.crypto?.kdf !== "PBKDF2-SHA-256" ||
    !parsed.crypto.salt ||
    !parsed.crypto.iv ||
    !parsed.payload
  ) {
    throw new Error("File ini bukan backup terenkripsi DANAPETA yang valid.");
  }
  return parsed;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
