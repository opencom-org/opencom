"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { BackendProvider, useBackend } from "@/contexts/BackendContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function ConvexWrapper({ children }: { children: ReactNode }) {
  const { convexUrl, isLoading } = useBackend();
  const [convex, setConvex] = useState<ConvexReactClient | null>(null);
  const clientRef = useRef<ConvexReactClient | null>(null);

  useEffect(() => {
    if (!convexUrl) {
      if (clientRef.current) {
        clientRef.current.close();
        clientRef.current = null;
        setConvex(null);
      }
      return;
    }

    // Close previous client before creating a new one
    if (clientRef.current) {
      clientRef.current.close();
    }

    const client = new ConvexReactClient(convexUrl);
    clientRef.current = client;
    setConvex(client);

    return () => {
      client.close();
      clientRef.current = null;
    };
  }, [convexUrl]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!convex) {
    if (convexUrl) {
      // Backend selected but client not yet created (useEffect pending) - show loading
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Connecting...</p>
          </div>
        </div>
      );
    }
    // No backend selected - render children without Convex/Auth providers
    return <>{children}</>;
  }

  // Backend selected - wrap with ConvexAuthProvider (includes ConvexProvider) and AuthProvider
  return (
    <ConvexAuthProvider client={convex}>
      <AuthProvider>{children}</AuthProvider>
    </ConvexAuthProvider>
  );
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <BackendProvider>
        <ConvexWrapper>{children}</ConvexWrapper>
      </BackendProvider>
    </ErrorBoundary>
  );
}
