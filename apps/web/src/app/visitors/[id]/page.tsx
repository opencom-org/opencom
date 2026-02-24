"use client";

import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Button } from "@opencom/ui";
import { ArrowLeft, Circle, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Id } from "@opencom/convex/dataModel";
import { formatVisitorIdentityLabel } from "@/lib/visitorIdentity";

function unknown(value?: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    return "Unknown";
  }
  return normalized;
}

function VisitorDetailContent(): React.JSX.Element | null {
  const { user, activeWorkspace } = useAuth();
  const params = useParams();
  const visitorId = params.id as Id<"visitors">;

  const detail = useQuery(
    api.visitors.getDirectoryDetail,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id, visitorId } : "skip"
  );

  if (!user || !activeWorkspace) {
    return null;
  }

  if (detail === undefined) {
    return (
      <div className="p-6" data-testid="visitor-detail-loading-state">
        Loading visitor...
      </div>
    );
  }

  if (detail.status !== "ok" || !detail.visitor) {
    let title = "Visitor not found";
    let message = "This visitor could not be loaded.";
    if (detail.status === "unauthenticated") {
      title = "Sign in required";
      message = "Authenticate to view visitor details.";
    } else if (detail.status === "forbidden") {
      title = "Permission denied";
      message = "Your account cannot access this visitor.";
    }

    return (
      <div className="p-6 space-y-4" data-testid="visitor-detail-error-state">
        <Link href="/visitors">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to visitors
          </Button>
        </Link>
        <Card className="p-6">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        </Card>
      </div>
    );
  }

  const visitor = detail.visitor;
  const customAttributes = Object.entries(visitor.customAttributes ?? {});

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/visitors">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="visitor-detail-heading">
              {formatVisitorIdentityLabel({
                visitorId: visitor._id,
                readableId: visitor.readableId,
                name: visitor.name,
                email: visitor.email,
              })}
            </h1>
            <p className="text-muted-foreground">Visitor profile and linked activity</p>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 text-sm"
          data-testid="visitor-detail-presence"
        >
          <Circle
            className={`h-2.5 w-2.5 ${
              visitor.isOnline ? "fill-green-500 text-green-500" : "fill-gray-300 text-gray-300"
            }`}
          />
          {visitor.isOnline ? "Online" : "Offline"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 space-y-2" data-testid="visitor-profile-panel">
          <h2 className="font-semibold">Profile</h2>
          <p className="text-sm">
            <span className="text-muted-foreground">Email:</span>{" "}
            <span data-testid="visitor-profile-email">{unknown(visitor.email)}</span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">External user ID:</span>{" "}
            <span data-testid="visitor-profile-external-id">{unknown(visitor.externalUserId)}</span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Session:</span> {unknown(visitor.sessionId)}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Last active:</span>{" "}
            {visitor.lastActiveAt ? new Date(visitor.lastActiveAt).toLocaleString() : "Unknown"}
          </p>
        </Card>

        <Card className="p-5 space-y-2" data-testid="visitor-context-panel">
          <h2 className="font-semibold">Context</h2>
          <p className="text-sm">
            <span className="text-muted-foreground">Location:</span>{" "}
            {unknown(visitor.location?.city)}, {unknown(visitor.location?.region)},{" "}
            {unknown(visitor.location?.country)}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Device:</span>{" "}
            {unknown(visitor.device?.deviceType)} / {unknown(visitor.device?.os)} /{" "}
            {unknown(visitor.device?.browser)}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Referrer:</span> {unknown(visitor.referrer)}
          </p>
          <p className="text-sm break-all">
            <span className="text-muted-foreground">Current URL:</span>{" "}
            {unknown(visitor.currentUrl)}
          </p>
        </Card>
      </div>

      <Card className="p-5" data-testid="visitor-custom-attributes-panel">
        <h2 className="font-semibold mb-3">Custom attributes</h2>
        {customAttributes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom attributes</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {customAttributes.map(([key, value]) => (
              <div key={key} className="text-sm border rounded-md p-2">
                <p className="text-muted-foreground">{key}</p>
                <p
                  className="font-medium break-all"
                  data-testid={`visitor-custom-attribute-${key}`}
                >
                  {typeof value === "string" ? value : JSON.stringify(value)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5" data-testid="visitor-linked-conversations-panel">
          <h2 className="font-semibold mb-3">Linked conversations</h2>
          {!detail.resourceAccess.conversations ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="visitor-linked-conversations-denied"
            >
              You do not have permission to view conversations.
            </p>
          ) : detail.linkedConversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked conversations</p>
          ) : (
            <div className="space-y-2">
              {detail.linkedConversations.map((conversation) => (
                <Link
                  key={conversation._id}
                  href={`/inbox?conversationId=${conversation._id}`}
                  className="block border rounded-md p-3 hover:bg-muted/50 transition-colors"
                  data-testid={`visitor-linked-conversation-${conversation._id}`}
                >
                  <p className="font-medium text-sm">{conversation.subject || "Conversation"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Status: {conversation.status} • {conversation.channel || "chat"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {conversation.lastMessagePreview || "No messages yet"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5" data-testid="visitor-linked-tickets-panel">
          <h2 className="font-semibold mb-3">Linked tickets</h2>
          {!detail.resourceAccess.tickets ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="visitor-linked-tickets-denied"
            >
              You do not have permission to view tickets.
            </p>
          ) : detail.linkedTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked tickets</p>
          ) : (
            <div className="space-y-2">
              {detail.linkedTickets.map((ticket) => (
                <Link
                  key={ticket._id}
                  href={`/tickets/${ticket._id}`}
                  className="block border rounded-md p-3 hover:bg-muted/50 transition-colors"
                  data-testid={`visitor-linked-ticket-${ticket._id}`}
                >
                  <p className="font-medium text-sm">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Status: {ticket.status} • Priority: {ticket.priority}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5 flex items-start gap-3 text-sm text-muted-foreground">
        <UserRound className="h-4 w-4 mt-0.5" />
        <p className="leading-relaxed">
          Missing metadata fields are shown as <strong>Unknown</strong> so operators can distinguish
          absent data from loading issues.
        </p>
      </Card>
    </div>
  );
}

export default function VisitorDetailPage(): React.JSX.Element {
  return (
    <AppLayout>
      <VisitorDetailContent />
    </AppLayout>
  );
}
