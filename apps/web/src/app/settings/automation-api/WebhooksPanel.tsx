"use client";

import { useState } from "react";
import { Button, Input } from "@opencom/ui";
import { Copy, Check, Plus, Webhook } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { appConfirm } from "@/lib/appConfirm";
import type { useAutomationApiConvex, SubscriptionRecord } from "../hooks/useAutomationApiConvex";

type Api = ReturnType<typeof useAutomationApiConvex>;

const KNOWN_EVENT_TYPES = [
  "conversation.created",
  "conversation.updated",
  "message.created",
  "visitor.updated",
  "ticket.created",
  "ticket.updated",
  "ticket.comment_added",
  "test.ping",
];

const KNOWN_RESOURCE_TYPES = [
  "conversation",
  "message",
  "visitor",
  "ticket",
  "article",
  "collection",
  "webhook",
];

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function SecretDisplay({ secret }: { secret: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-medium text-amber-800 mb-2">
        Copy this signing secret now — it won't be shown again.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-white px-3 py-2 rounded text-sm font-mono border break-all">
          {secret}
        </code>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    paused: "bg-amber-100 text-amber-700",
    disabled: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function MultiCheckboxField({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}): React.JSX.Element {
  const selectedSet = new Set(selected);
  const toggle = (value: string) => {
    const next = new Set(selectedSet);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(Array.from(next));
  };

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-1 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={selectedSet.has(opt)}
              onChange={() => toggle(opt)}
              className="rounded border-gray-300"
            />
            {opt}
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs text-muted-foreground hover:underline mt-1"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function WebhookRow({
  sub,
  workspaceId,
  api,
  onError,
}: {
  sub: SubscriptionRecord;
  workspaceId: Id<"workspaces">;
  api: Api;
  onError: (msg: string) => void;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [editUrl, setEditUrl] = useState(sub.url);
  const [editEventTypes, setEditEventTypes] = useState<string[]>(sub.eventTypes ?? []);
  const [editResourceTypes, setEditResourceTypes] = useState<string[]>(sub.resourceTypes ?? []);
  const [isSaving, setIsSaving] = useState(false);

  const handlePauseResume = async () => {
    try {
      const newStatus = sub.status === "active" ? "paused" : "active";
      await api.updateSubscription({
        workspaceId,
        subscriptionId: sub._id,
        status: newStatus,
      });
    } catch (error) {
      onError(`Failed to ${sub.status === "active" ? "pause" : "resume"} webhook: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleTest = async () => {
    try {
      await api.testSubscription({ workspaceId, subscriptionId: sub._id });
    } catch (error) {
      onError(`Failed to send test: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleDelete = async () => {
    if (!(await appConfirm({
      title: "Delete Webhook",
      message: "This will permanently delete this webhook subscription.",
      confirmText: "Delete",
      destructive: true,
    }))) return;
    try {
      await api.deleteSubscription({ workspaceId, subscriptionId: sub._id });
    } catch (error) {
      onError(`Failed to delete webhook: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleSaveEdit = async () => {
    if (!editUrl.trim()) return;
    if (!editUrl.trim().startsWith("https://")) {
      onError("Webhook URL must use HTTPS");
      return;
    }
    setIsSaving(true);
    try {
      await api.updateSubscription({
        workspaceId,
        subscriptionId: sub._id,
        url: editUrl.trim(),
        eventTypes: editEventTypes.length > 0 ? editEventTypes : undefined,
        resourceTypes: editResourceTypes.length > 0 ? editResourceTypes : undefined,
      });
      setEditing(false);
    } catch (error) {
      onError(`Failed to save webhook: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditUrl(sub.url);
    setEditEventTypes(sub.eventTypes ?? []);
    setEditResourceTypes(sub.resourceTypes ?? []);
  };

  const filterSummary = [
    ...(sub.eventTypes?.length ? [`${sub.eventTypes.length} events`] : []),
    ...(sub.resourceTypes?.length ? [`${sub.resourceTypes.length} resources`] : []),
  ].join(", ") || "all events";

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm truncate max-w-[300px]">{sub.url}</span>
            <StatusBadge status={sub.status} />
          </div>
          <div className="text-xs text-muted-foreground mt-1 space-x-3">
            <span>{filterSummary}</span>
            <code>{sub.signingSecretPrefix}...</code>
            <span>Created {formatRelativeTime(sub.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={handlePauseResume}>
            {sub.status === "active" ? "Pause" : "Resume"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleTest}>
            Test
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 border-t pt-3 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">URL</label>
            <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
          </div>
          <MultiCheckboxField
            label="Event types (leave empty for all)"
            options={KNOWN_EVENT_TYPES}
            selected={editEventTypes}
            onChange={setEditEventTypes}
          />
          <MultiCheckboxField
            label="Resource types (leave empty for all)"
            options={KNOWN_RESOURCE_TYPES}
            selected={editResourceTypes}
            onChange={setEditResourceTypes}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveEdit} disabled={isSaving || !editUrl.trim()}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function WebhooksPanel({
  workspaceId,
  api,
}: {
  workspaceId: Id<"workspaces">;
  api: Api;
}): React.JSX.Element {
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState("");
  const [createEventTypes, setCreateEventTypes] = useState<string[]>([]);
  const [createResourceTypes, setCreateResourceTypes] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const subscriptions = api.subscriptions;

  const handleCreate = async () => {
    if (!url.trim()) return;
    if (!url.trim().startsWith("https://")) {
      setErrorMessage("Webhook URL must use HTTPS");
      return;
    }
    setErrorMessage(null);
    setIsCreating(true);
    try {
      const result = await api.createSubscription({
        workspaceId,
        url: url.trim(),
        eventTypes: createEventTypes.length > 0 ? createEventTypes : undefined,
        resourceTypes: createResourceTypes.length > 0 ? createResourceTypes : undefined,
      });
      setNewSecret(result.signingSecret);
      setUrl("");
      setCreateEventTypes([]);
      setCreateResourceTypes([]);
      setShowCreate(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create webhook");
    } finally {
      setIsCreating(false);
    }
  };

  if (subscriptions === undefined) {
    return <p className="text-sm text-muted-foreground py-4">Loading webhooks...</p>;
  }

  if (subscriptions.length === 0 && !showCreate && !newSecret) {
    return (
      <div className="text-center py-8">
        <Webhook className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-3">No webhooks</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Webhook
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
          <button type="button" onClick={() => setErrorMessage(null)} className="ml-2 font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {newSecret && <SecretDisplay secret={newSecret} />}

      <div className="flex justify-end">
        {!showCreate && (
          <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Webhook
          </Button>
        )}
      </div>

      {showCreate && (
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium">New Webhook</h3>
          <div>
            <label className="text-xs text-muted-foreground">Endpoint URL</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhooks" />
          </div>
          <MultiCheckboxField
            label="Event types (leave empty for all)"
            options={KNOWN_EVENT_TYPES}
            selected={createEventTypes}
            onChange={setCreateEventTypes}
          />
          <MultiCheckboxField
            label="Resource types (leave empty for all)"
            options={KNOWN_RESOURCE_TYPES}
            selected={createResourceTypes}
            onChange={setCreateResourceTypes}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={isCreating || !url.trim()}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowCreate(false); setUrl(""); setCreateEventTypes([]); setCreateResourceTypes([]); }}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {subscriptions.map((sub) => (
          <WebhookRow key={sub._id} sub={sub} workspaceId={workspaceId} api={api} onError={setErrorMessage} />
        ))}
      </div>
    </div>
  );
}
