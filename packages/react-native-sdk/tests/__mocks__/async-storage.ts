const storage: Record<string, string> = {};

export default {
  getItem: async (key: string) => storage[key] ?? null,
  setItem: async (key: string, value: string) => {
    storage[key] = value;
  },
  removeItem: async (key: string) => {
    delete storage[key];
  },
};
