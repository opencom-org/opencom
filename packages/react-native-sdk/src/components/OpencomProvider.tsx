import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { OpencomSDK } from "../OpencomSDK";
import type { SDKConfig } from "@opencom/sdk-core";

interface OpencomContextValue {
  isInitialized: boolean;
  workspaceId: string;
}

const OpencomContext = createContext<OpencomContextValue | null>(null);

export function useOpencomContext(): OpencomContextValue {
  const context = useContext(OpencomContext);
  if (!context) {
    throw new Error("useOpencomContext must be used within OpencomProvider");
  }
  return context;
}

interface OpencomContextProviderProps {
  value: OpencomContextValue;
  client: ConvexReactClient;
  children: ReactNode;
}

export function OpencomContextProvider({ value, client, children }: OpencomContextProviderProps) {
  return (
    <OpencomContext.Provider value={value}>
      <ConvexProvider client={client}>{children}</ConvexProvider>
    </OpencomContext.Provider>
  );
}

interface OpencomProviderProps {
  config: SDKConfig;
  children: ReactNode;
}

export function OpencomProvider({ config, children }: OpencomProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [convexClient, setConvexClient] = useState<ConvexReactClient | null>(null);

  useEffect(() => {
    const init = async () => {
      await OpencomSDK.initialize(config);
      setConvexClient(new ConvexReactClient(config.convexUrl));
      setIsInitialized(true);
    };

    init().catch(console.error);

    return () => {
      OpencomSDK.reset().catch(console.error);
    };
  }, [config.workspaceId, config.convexUrl]);

  if (!isInitialized || !convexClient) {
    return null;
  }

  return (
    <OpencomContextProvider
      value={{ isInitialized, workspaceId: config.workspaceId }}
      client={convexClient}
    >
      {children}
    </OpencomContextProvider>
  );
}
