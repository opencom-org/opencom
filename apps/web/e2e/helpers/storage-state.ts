import type { Page } from "@playwright/test";
import * as fs from "fs";

type StorageStateEntry = {
  name: string;
  value: string;
};

type StorageStateOrigin = {
  localStorage?: StorageStateEntry[];
  [key: string]: unknown;
};

type StorageStateLike = {
  origins?: StorageStateOrigin[];
  [key: string]: unknown;
};

const VOLATILE_LOCAL_STORAGE_KEYS = new Set([
  "opencom_session_id",
  "opencom_visitor_id",
  "opencom_settings_cache",
]);

const VOLATILE_LOCAL_STORAGE_PREFIXES = ["opencom_settings_cache_"];

function isVolatileLocalStorageKey(name: string): boolean {
  if (VOLATILE_LOCAL_STORAGE_KEYS.has(name)) {
    return true;
  }

  return VOLATILE_LOCAL_STORAGE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export function sanitizeStorageState<T extends StorageStateLike>(storageState: T): T {
  if (!storageState.origins?.length) {
    return storageState;
  }

  return {
    ...storageState,
    origins: storageState.origins.map((origin) => {
      if (!origin.localStorage?.length) {
        return origin;
      }

      return {
        ...origin,
        localStorage: origin.localStorage.filter(
          (entry) => !isVolatileLocalStorageKey(entry.name)
        ),
      };
    }),
  };
}

export function sanitizeStorageStateFile(storageStatePath: string): void {
  if (!fs.existsSync(storageStatePath)) {
    return;
  }

  try {
    const raw = fs.readFileSync(storageStatePath, "utf-8");
    const parsed = JSON.parse(raw) as StorageStateLike;
    const sanitized = sanitizeStorageState(parsed);
    fs.writeFileSync(storageStatePath, JSON.stringify(sanitized, null, 2), { mode: 0o600 });
  } catch (error) {
    console.warn(`[storage-state] Failed to sanitize ${storageStatePath}:`, error);
  }
}

export async function clearVolatileWidgetClientState(page: Page): Promise<void> {
  await page.evaluate(
    ({ volatileKeys, volatilePrefixes }) => {
      for (const key of volatileKeys) {
        localStorage.removeItem(key);
      }

      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (!key) {
          continue;
        }

        if (volatilePrefixes.some((prefix) => key.startsWith(prefix))) {
          localStorage.removeItem(key);
        }
      }

      sessionStorage.removeItem("opencom_email_dismissed");
    },
    {
      volatileKeys: [...VOLATILE_LOCAL_STORAGE_KEYS],
      volatilePrefixes: VOLATILE_LOCAL_STORAGE_PREFIXES,
    }
  );
}
