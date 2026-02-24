"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { AppLayout, AppPageShell } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Input, Button } from "@opencom/ui";
import { Search, UserRound, Circle } from "lucide-react";
import Link from "next/link";
import { formatVisitorEmailLabel, formatVisitorIdentityLabel } from "@/lib/visitorIdentity";

const PAGE_SIZE = 20;

type PresenceFilter = "all" | "online" | "offline";

function formatLastActive(timestamp?: number): string {
  if (!timestamp) {
    return "Unknown";
  }
  return new Date(timestamp).toLocaleString();
}

function VisitorsContent(): React.JSX.Element | null {
  const { user, activeWorkspace } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>("all");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, presenceFilter, activeWorkspace?._id]);

  const directoryResult = useQuery(
    api.visitors.listDirectory,
    activeWorkspace?._id
      ? {
          workspaceId: activeWorkspace._id,
          search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
          presence: presenceFilter,
          limit: PAGE_SIZE,
          offset,
        }
      : "skip"
  );

  const pageMeta = useMemo(() => {
    if (!directoryResult || directoryResult.status !== "ok") {
      return { from: 0, to: 0, total: 0 };
    }
    const from = directoryResult.totalCount === 0 ? 0 : offset + 1;
    const to = Math.min(offset + directoryResult.visitors.length, directoryResult.totalCount);
    return { from, to, total: directoryResult.totalCount };
  }, [directoryResult, offset]);

  if (!user || !activeWorkspace) {
    return null;
  }

  const isLoading = directoryResult === undefined;
  const isPermissionDenied = directoryResult?.status === "forbidden";
  const isUnauthenticated = directoryResult?.status === "unauthenticated";
  const visitors = directoryResult?.status === "ok" ? directoryResult.visitors : [];
  const canGoPrev = offset > 0;
  const canGoNext = directoryResult?.status === "ok" ? directoryResult.hasMore : false;

  return (
    <AppPageShell className="h-full overflow-y-auto" data-testid="visitors-responsive-shell">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="visitors-page-heading">
          Visitors
        </h1>
        <p className="text-muted-foreground">
          Browse and inspect visitors in your active workspace.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name, email, external user ID, visitor ID, or readable ID"
            className="pl-10"
            data-testid="visitors-search-input"
          />
        </div>
        <select
          value={presenceFilter}
          onChange={(event) => setPresenceFilter(event.target.value as PresenceFilter)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
          data-testid="visitors-presence-filter"
        >
          <option value="all">All</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      <p className="text-xs text-muted-foreground" data-testid="visitors-search-help">
        Search supports name, email, external user ID, internal visitor ID, and readable visitor ID.
      </p>

      <p className="text-sm text-muted-foreground" data-testid="visitors-results-meta">
        {isLoading ? "Loading visitors..." : `${pageMeta.from}-${pageMeta.to} of ${pageMeta.total}`}
      </p>

      {isLoading ? (
        <Card className="p-6 text-muted-foreground" data-testid="visitors-loading-state">
          Loading visitors...
        </Card>
      ) : isUnauthenticated ? (
        <Card className="p-6" data-testid="visitors-error-state">
          <p className="font-medium">Sign in required</p>
          <p className="text-sm text-muted-foreground mt-1">Authenticate to access visitor data.</p>
        </Card>
      ) : isPermissionDenied ? (
        <Card className="p-6" data-testid="visitors-error-state">
          <p className="font-medium">Permission denied</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your account does not have permission to read visitors.
          </p>
        </Card>
      ) : visitors.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground" data-testid="visitors-empty-state">
          <UserRound className="h-10 w-10 mx-auto mb-3 opacity-60" />
          <p className="font-medium text-foreground">No visitors found</p>
          <p className="text-sm mt-1">Adjust your search or wait for new visitor activity.</p>
        </Card>
      ) : (
        <Card className="divide-y" data-testid="visitors-list">
          {visitors.map((visitor) => (
            <Link
              key={visitor._id}
              href={`/visitors/${visitor._id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50 transition-colors"
              data-testid={`visitors-row-${visitor._id}`}
            >
              <div className="min-w-0">
                <p className="font-medium truncate" data-testid={`visitors-name-${visitor._id}`}>
                  {formatVisitorIdentityLabel({
                    visitorId: visitor._id,
                    readableId: visitor.readableId,
                    name: visitor.name,
                    email: visitor.email,
                  })}
                </p>
                <p
                  className="text-sm text-muted-foreground truncate"
                  data-testid={`visitors-email-${visitor._id}`}
                >
                  {formatVisitorEmailLabel({
                    visitorId: visitor._id,
                    readableId: visitor.readableId,
                    email: visitor.email,
                  })}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  External ID: {visitor.externalUserId || "Unknown"}
                </p>
              </div>
              <div className="text-right">
                <span
                  className="inline-flex items-center gap-1 text-xs"
                  data-testid={`visitors-presence-${visitor._id}`}
                >
                  <Circle
                    className={`h-2 w-2 ${
                      visitor.isOnline
                        ? "fill-green-500 text-green-500"
                        : "fill-gray-300 text-gray-300"
                    }`}
                  />
                  {visitor.isOnline ? "Online" : "Offline"}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Last active: {formatLastActive(visitor.lastActiveAt)}
                </p>
              </div>
            </Link>
          ))}
        </Card>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoPrev || isLoading}
          onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
          data-testid="visitors-prev-page"
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoNext || isLoading}
          onClick={() =>
            setOffset((current) =>
              directoryResult?.status === "ok" && directoryResult.nextOffset !== null
                ? directoryResult.nextOffset
                : current
            )
          }
          data-testid="visitors-next-page"
        >
          Next
        </Button>
      </div>
    </AppPageShell>
  );
}

export default function VisitorsPage(): React.JSX.Element {
  return (
    <AppLayout>
      <VisitorsContent />
    </AppLayout>
  );
}
