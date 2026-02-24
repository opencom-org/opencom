"use client";

import { useState } from "react";
import { useBackend } from "@/contexts/BackendContext";
import {
  Button,
  Input,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@opencom/ui";
import { Server, ChevronDown, ChevronUp } from "lucide-react";
import type { StoredBackend } from "@opencom/types";

interface BackendSelectorProps {
  onConnected?: () => void;
}

export function BackendSelector({ onConnected }: BackendSelectorProps) {
  const { activeBackend, recentBackends, selectBackend, defaultBackendUrl } = useBackend();
  const [url, setUrl] = useState(defaultBackendUrl ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRecent, setShowRecent] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError("Please enter a backend URL");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await selectBackend(url.trim());
      if (result.success) {
        onConnected?.();
      } else {
        setError(result.error ?? "Could not connect to backend");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRecent = async (backend: StoredBackend) => {
    setIsLoading(true);
    setError("");

    try {
      const result = await selectBackend(backend.url);
      if (result.success) {
        onConnected?.();
      } else {
        setError(result.error ?? "Could not connect to backend");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (activeBackend) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Server className="h-4 w-4" />
          <span>Connected to:</span>
          <span className="font-medium text-foreground">{activeBackend.name}</span>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Server className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Connect to Backend</CardTitle>
        <CardDescription>Enter your Opencom backend URL to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleConnect} className="space-y-4">
          {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}

          <div className="space-y-2">
            <label htmlFor="backend-url" className="text-sm font-medium">
              Backend URL
            </label>
            <Input
              id="backend-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-instance.convex.cloud"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Enter your Convex deployment URL (e.g., https://your-project-123.convex.cloud). HTTPS
              is required. The connection will be validated before proceeding.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Connecting..." : "Connect"}
          </Button>

          {recentBackends.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                className="flex items-center justify-center gap-1 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowRecent(!showRecent)}
              >
                Recent backends
                {showRecent ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showRecent && (
                <div className="mt-2 space-y-2">
                  {recentBackends.map((backend) => (
                    <button
                      key={backend.url}
                      type="button"
                      className="w-full p-3 text-left border rounded-md hover:bg-muted transition-colors"
                      onClick={() => handleSelectRecent(backend)}
                      disabled={isLoading}
                    >
                      <div className="font-medium text-sm">{backend.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{backend.url}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
