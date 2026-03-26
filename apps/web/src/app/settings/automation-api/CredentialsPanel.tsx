"use client";

import { useState } from "react";
import { Button, Input } from "@opencom/ui";
import { Copy, Check, Key, Plus } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { appConfirm } from "@/lib/appConfirm";
import type { useAutomationApiConvex } from "../hooks/useAutomationApiConvex";
import { ScopeSelector } from "./ScopeSelector";

type Api = ReturnType<typeof useAutomationApiConvex>;

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
        Copy this secret now — it won't be shown again.
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
    disabled: "bg-gray-100 text-gray-600",
    expired: "bg-red-100 text-red-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export function CredentialsPanel({
  workspaceId,
  api,
}: {
  workspaceId: Id<"workspaces">;
  api: Api;
}): React.JSX.Element {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [actorName, setActorName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const credentials = api.credentials;

  const handleCreate = async () => {
    if (!name.trim() || !actorName.trim() || scopes.length === 0) return;
    setErrorMessage(null);
    setIsCreating(true);
    try {
      const result = await api.createCredential({
        workspaceId,
        name: name.trim(),
        actorName: actorName.trim(),
        scopes,
      });
      setNewSecret(result.secret);
      setName("");
      setActorName("");
      setScopes([]);
      setShowCreate(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRotate = async (credentialId: Id<"automationCredentials">) => {
    if (!(await appConfirm({
      title: "Rotate API Key",
      message: "This will invalidate the current secret. Any integrations using it will stop working.",
      confirmText: "Rotate",
      destructive: true,
    }))) return;

    setErrorMessage(null);
    try {
      const result = await api.rotateCredential({ workspaceId, credentialId });
      setRotatedSecret({ id: credentialId, secret: result.secret });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to rotate key");
    }
  };

  const handleToggle = async (credentialId: Id<"automationCredentials">, currentStatus: string) => {
    setErrorMessage(null);
    try {
      if (currentStatus === "active") {
        await api.disableCredential({ workspaceId, credentialId });
      } else {
        await api.enableCredential({ workspaceId, credentialId });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update key status");
    }
  };

  const handleDelete = async (credentialId: Id<"automationCredentials">) => {
    if (!(await appConfirm({
      title: "Delete API Key",
      message: "This will permanently delete this API key. This action cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    }))) return;

    setErrorMessage(null);
    try {
      await api.removeCredential({ workspaceId, credentialId });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete key");
    }
  };

  if (credentials === undefined) {
    return <p className="text-sm text-muted-foreground py-4">Loading API keys...</p>;
  }

  if (credentials.length === 0 && !showCreate && !newSecret) {
    return (
      <div className="text-center py-8">
        <Key className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-3">No API keys</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Create API Key
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
            <Plus className="h-4 w-4 mr-1" /> Create Key
          </Button>
        )}
      </div>

      {showCreate && (
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium">New API Key</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production Integration" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Actor Name</label>
              <Input value={actorName} onChange={(e) => setActorName(e.target.value)} placeholder="e.g. CRM Bot" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Scopes</label>
            <ScopeSelector value={scopes} onChange={setScopes} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={isCreating || !name.trim() || !actorName.trim() || scopes.length === 0}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {credentials.map((cred) => (
          <div key={cred._id} className="border rounded-lg p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{cred.name}</span>
                  <StatusBadge status={cred.status} />
                </div>
                <div className="text-xs text-muted-foreground mt-1 space-x-3">
                  <code>{cred.secretPrefix}...</code>
                  <span>{cred.scopes.length} scope{cred.scopes.length !== 1 ? "s" : ""}</span>
                  {cred.lastUsedAt && <span>Used {formatRelativeTime(cred.lastUsedAt)}</span>}
                  <span>Created {formatRelativeTime(cred.createdAt)}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => handleRotate(cred._id)}>Rotate</Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggle(cred._id, cred.status)}
                >
                  {cred.status === "active" ? "Disable" : "Enable"}
                </Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDelete(cred._id)}>Delete</Button>
              </div>
            </div>
            {rotatedSecret?.id === cred._id && (
              <SecretDisplay secret={rotatedSecret.secret} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
