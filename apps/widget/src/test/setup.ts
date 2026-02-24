import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

function createStorageShim(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  };
}

const currentStorage = (globalThis as { localStorage?: Storage }).localStorage;
if (
  !currentStorage ||
  typeof currentStorage.clear !== "function" ||
  typeof currentStorage.getItem !== "function" ||
  typeof currentStorage.setItem !== "function" ||
  typeof currentStorage.removeItem !== "function"
) {
  Object.defineProperty(globalThis, "localStorage", {
    value: createStorageShim(),
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

afterEach(() => {
  cleanup();
});
