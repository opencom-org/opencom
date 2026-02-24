import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StoredBackend, BackendStorage, DiscoveryResponse } from "@opencom/types";
import { validateBackendUrl } from "@opencom/types";

const BACKEND_STORAGE_KEY = "opencom_backends";
const DEFAULT_BACKEND_URL = process.env.EXPO_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL;

interface BackendContextType {
  activeBackend: StoredBackend | null;
  recentBackends: StoredBackend[];
  isLoading: boolean;
  convexUrl: string | null;
  selectBackend: (
    url: string
  ) => Promise<{ success: boolean; error?: string; discovery?: DiscoveryResponse }>;
  clearBackend: () => Promise<void>;
  defaultBackendUrl: string | undefined;
}

const BackendContext = createContext<BackendContextType | null>(null);

export function BackendProvider({ children }: { children: React.ReactNode }) {
  const [activeBackend, setActiveBackend] = useState<StoredBackend | null>(null);
  const [recentBackends, setRecentBackends] = useState<StoredBackend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBackendStorage();
  }, []);

  async function loadBackendStorage() {
    try {
      const stored = await AsyncStorage.getItem(BACKEND_STORAGE_KEY);
      if (stored) {
        const data: BackendStorage = JSON.parse(stored);
        let backends = data.backends;
        let activeBackendToUse = data.activeBackend
          ? (data.backends.find((b) => b.url === data.activeBackend) ?? null)
          : null;

        if (activeBackendToUse) {
          const refreshed = await validateBackendUrl(activeBackendToUse.url);
          if (refreshed.valid && refreshed.discovery) {
            const refreshedBackend: StoredBackend = {
              ...activeBackendToUse,
              name: refreshed.discovery.name,
              convexUrl: refreshed.discovery.convexUrl,
              features: refreshed.discovery.features,
              signupMode: refreshed.discovery.signupMode,
              authMethods: refreshed.discovery.authMethods,
            };

            backends = backends.map((backend) =>
              backend.url === refreshedBackend.url ? refreshedBackend : backend
            );
            activeBackendToUse = refreshedBackend;
            await saveBackendStorage(backends, refreshedBackend.url);
          }
        }

        setRecentBackends(backends);
        setActiveBackend(activeBackendToUse);
      }
    } catch (error) {
      console.error("Failed to load backend storage:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveBackendStorage(backends: StoredBackend[], activeUrl: string | null) {
    try {
      const data: BackendStorage = {
        backends,
        activeBackend: activeUrl,
      };
      await AsyncStorage.setItem(BACKEND_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save backend storage:", error);
    }
  }

  const selectBackend = useCallback(
    async (url: string) => {
      const result = await validateBackendUrl(url);

      if (!result.valid || !result.discovery) {
        return { success: false, error: result.error };
      }

      const newBackend: StoredBackend = {
        url: url.replace(/\/$/, ""),
        name: result.discovery.name,
        convexUrl: result.discovery.convexUrl,
        features: result.discovery.features,
        signupMode: result.discovery.signupMode,
        authMethods: result.discovery.authMethods,
        lastUsed: new Date().toISOString(),
      };

      // Update recent backends list
      const updatedBackends = [
        newBackend,
        ...recentBackends.filter((b) => b.url !== newBackend.url),
      ].slice(0, 10); // Keep max 10 recent backends

      setActiveBackend(newBackend);
      setRecentBackends(updatedBackends);
      await saveBackendStorage(updatedBackends, newBackend.url);

      return { success: true, discovery: result.discovery };
    },
    [recentBackends]
  );

  const clearBackend = useCallback(async () => {
    setActiveBackend(null);
    await saveBackendStorage(recentBackends, null);
  }, [recentBackends]);

  const value: BackendContextType = {
    activeBackend,
    recentBackends,
    isLoading,
    convexUrl: activeBackend?.convexUrl ?? null,
    selectBackend,
    clearBackend,
    defaultBackendUrl: DEFAULT_BACKEND_URL,
  };

  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

export function useBackend() {
  const context = useContext(BackendContext);
  if (!context) {
    throw new Error("useBackend must be used within a BackendProvider");
  }
  return context;
}
