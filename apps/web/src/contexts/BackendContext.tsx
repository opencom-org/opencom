"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { StoredBackend, BackendStorage, DiscoveryResponse } from "@opencom/types";
import { validateBackendUrl } from "@opencom/types";

const BACKEND_STORAGE_KEY = "opencom_backends";
const DEFAULT_BACKEND_URL = process.env.NEXT_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL;

// Auth storage keys - must match AuthContext
const AUTH_STORAGE_KEYS = [
  "opencom_auth_token",
  "opencom_user",
  "opencom_workspaces",
  "opencom_active_workspace",
];

function clearAuthStorage() {
  AUTH_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
  });
}

function normalizeBackendUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function buildStoredBackend(url: string, discovery: DiscoveryResponse): StoredBackend {
  return {
    url: normalizeBackendUrl(url),
    name: discovery.name,
    convexUrl: discovery.convexUrl,
    lastUsed: new Date().toISOString(),
    signupMode: discovery.signupMode,
    authMethods: discovery.authMethods,
  };
}

function getBackendUrlFromQueryParam(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const backendUrl = searchParams.get("backendurl") ?? searchParams.get("backendUrl");
  if (!backendUrl) {
    return null;
  }

  const trimmedBackendUrl = backendUrl.trim();
  if (trimmedBackendUrl.length === 0) {
    return null;
  }

  try {
    return decodeURIComponent(trimmedBackendUrl);
  } catch {
    return trimmedBackendUrl;
  }
}

interface BackendContextType {
  activeBackend: StoredBackend | null;
  recentBackends: StoredBackend[];
  isLoading: boolean;
  convexUrl: string | null;
  selectBackend: (
    url: string
  ) => Promise<{ success: boolean; error?: string; discovery?: DiscoveryResponse }>;
  clearBackend: () => void;
  defaultBackendUrl: string | undefined;
}

const BackendContext = createContext<BackendContextType | null>(null);

export function BackendProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [activeBackend, setActiveBackend] = useState<StoredBackend | null>(null);
  const [recentBackends, setRecentBackends] = useState<StoredBackend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadBackendStorage();
  }, []);

  async function loadBackendStorage() {
    try {
      let loadedBackends: StoredBackend[] = [];
      let loadedActiveBackend: StoredBackend | null = null;

      const stored = localStorage.getItem(BACKEND_STORAGE_KEY);
      if (stored) {
        const data: BackendStorage = JSON.parse(stored);
        loadedBackends = data.backends;
        if (data.activeBackend) {
          const active = data.backends.find((b) => b.url === data.activeBackend);
          loadedActiveBackend = active ?? null;
        }
      }

      const queryParamBackendUrl = getBackendUrlFromQueryParam();
      const autoSelectBackendUrl = queryParamBackendUrl ?? DEFAULT_BACKEND_URL;

      if (autoSelectBackendUrl) {
        const autoSelectResult = await validateBackendUrl(autoSelectBackendUrl);
        if (autoSelectResult.valid && autoSelectResult.discovery) {
          const autoSelectedBackend = buildStoredBackend(
            autoSelectBackendUrl,
            autoSelectResult.discovery
          );

          if (
            loadedActiveBackend?.convexUrl &&
            loadedActiveBackend.convexUrl !== autoSelectedBackend.convexUrl
          ) {
            clearAuthStorage();
          }

          loadedBackends = [
            autoSelectedBackend,
            ...loadedBackends.filter((backend) => backend.url !== autoSelectedBackend.url),
          ].slice(0, 10);
          loadedActiveBackend = autoSelectedBackend;
          saveBackendStorage(loadedBackends, autoSelectedBackend.url);
        } else {
          if (queryParamBackendUrl) {
            console.warn(
              "Backend URL query param provided but validation failed:",
              autoSelectResult.error
            );
          } else {
            console.warn("Default backend validation failed:", autoSelectResult.error);
          }
        }
      }

      setRecentBackends(loadedBackends);
      setActiveBackend(loadedActiveBackend);
    } catch (error) {
      console.error("Failed to load backend storage:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function saveBackendStorage(backends: StoredBackend[], activeUrl: string | null) {
    try {
      const data: BackendStorage = {
        backends,
        activeBackend: activeUrl,
      };
      localStorage.setItem(BACKEND_STORAGE_KEY, JSON.stringify(data));
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

      const newBackend = buildStoredBackend(url, result.discovery);

      // Clear auth when switching to a different backend
      if (activeBackend?.convexUrl !== newBackend.convexUrl) {
        clearAuthStorage();
      }

      // Update recent backends list
      const updatedBackends = [
        newBackend,
        ...recentBackends.filter((b) => b.url !== newBackend.url),
      ].slice(0, 10); // Keep max 10 recent backends

      setActiveBackend(newBackend);
      setRecentBackends(updatedBackends);
      saveBackendStorage(updatedBackends, newBackend.url);

      return { success: true, discovery: result.discovery };
    },
    [recentBackends, activeBackend]
  );

  const clearBackend = useCallback(() => {
    clearAuthStorage();
    setActiveBackend(null);
    saveBackendStorage(recentBackends, null);
  }, [recentBackends]);

  return (
    <BackendContext.Provider
      value={{
        activeBackend,
        recentBackends,
        isLoading,
        convexUrl: activeBackend?.convexUrl ?? null,
        selectBackend,
        clearBackend,
        defaultBackendUrl: DEFAULT_BACKEND_URL,
      }}
    >
      {children}
    </BackendContext.Provider>
  );
}

export function useBackend() {
  const context = useContext(BackendContext);
  if (!context) {
    throw new Error("useBackend must be used within a BackendProvider");
  }
  return context;
}
