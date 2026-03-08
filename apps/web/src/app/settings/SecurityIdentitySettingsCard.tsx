"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@opencom/ui";
import { Check, Copy } from "lucide-react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { appConfirm } from "@/lib/appConfirm";

export function SecurityIdentitySettingsCard({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}): React.JSX.Element {
  // @ts-expect-error Convex generated API refs can exceed TS instantiation depth in this component.
  const identitySettings = useQuery(api.identityVerification.getSettings, { workspaceId });
  // @ts-expect-error Convex generated API refs can exceed TS instantiation depth in this component.
  const identitySecret = useQuery(api.identityVerification.getSecret, { workspaceId });

  // @ts-expect-error Convex generated API refs can exceed TS instantiation depth in this component.
  const enableIdentity = useMutation(api.identityVerification.enable);
  // @ts-expect-error Convex generated API refs can exceed TS instantiation depth in this component.
  const disableIdentity = useMutation(api.identityVerification.disable);
  // @ts-expect-error Convex generated API refs can exceed TS instantiation depth in this component.
  const updateMode = useMutation(api.identityVerification.updateMode);
  // @ts-expect-error Convex generated API refs can exceed TS instantiation depth in this component.
  const rotateSecret = useMutation(api.identityVerification.rotateSecret);

  const [showSecret, setShowSecret] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  const handleEnableIdentity = async () => {
    setIsSaving(true);
    try {
      const result = await enableIdentity({ workspaceId });
      if (result.secret) {
        setNewSecret(result.secret);
        setShowSecret(true);
      }
    } catch (error) {
      console.error("Failed to enable identity verification:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisableIdentity = async () => {
    setIsSaving(true);
    try {
      await disableIdentity({ workspaceId, confirmDisable: true });
      setShowDisableConfirm(false);
    } catch (error) {
      console.error("Failed to disable identity verification:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRotateSecret = async () => {
    if (!(await appConfirm("Are you sure? Users with the old secret will no longer be verified."))) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await rotateSecret({ workspaceId });
      if (result.secret) {
        setNewSecret(result.secret);
        setShowSecret(true);
      }
    } catch (error) {
      console.error("Failed to rotate secret:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleModeChange = async (mode: "optional" | "required") => {
    try {
      await updateMode({ workspaceId, mode });
    } catch (error) {
      console.error("Failed to update mode:", error);
    }
  };

  const copySecret = () => {
    const secret = newSecret || identitySecret?.secret;
    if (!secret) {
      return;
    }

    void navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-medium">Identity Verification (HMAC)</h3>
          <p className="text-sm text-muted-foreground">
            Verify user identity in the widget to prevent impersonation
          </p>
        </div>
        <button
          type="button"
          onClick={
            identitySettings?.enabled ? () => setShowDisableConfirm(true) : handleEnableIdentity
          }
          disabled={isSaving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            identitySettings?.enabled ? "bg-primary" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              identitySettings?.enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {!identitySettings?.enabled && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          <strong>Warning:</strong> Without identity verification, users can be impersonated in the
          widget.
        </div>
      )}

      {identitySettings?.enabled && (
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium">Verification Mode</label>
            <select
              value={identitySettings.mode}
              onChange={(event) =>
                handleModeChange(event.target.value as "optional" | "required")
              }
              className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
            >
              <option value="optional">Optional (recommended for getting started)</option>
              <option value="required">Required (reject unverified users)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">HMAC Secret</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="bg-muted px-3 py-2 rounded font-mono text-sm flex-1 overflow-hidden">
                {showSecret
                  ? newSecret || identitySecret?.secret || "********"
                  : "••••••••••••••••••••••••"}
              </code>
              <Button variant="outline" size="sm" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? "Hide" : "Show"}
              </Button>
              <Button variant="outline" size="sm" onClick={copySecret}>
                {secretCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Use this secret server-side to generate HMAC hashes for user IDs.
            </p>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-2">Integration Example (Node.js)</p>
            <pre className="text-xs bg-zinc-950 text-zinc-100 p-3 rounded overflow-x-auto">
              {`const crypto = require('crypto');

function generateUserHash(userId, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(userId)
    .digest('hex');
}

// Pass to widget:
Opencom.identify({
  userId: user.id,
  userHash: generateUserHash(user.id, HMAC_SECRET)
});`}
            </pre>
          </div>

          <Button variant="outline" onClick={handleRotateSecret} disabled={isSaving}>
            Rotate Secret
          </Button>
        </div>
      )}

      {showDisableConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-md">
            <h3 className="font-semibold text-lg mb-2">Disable Identity Verification?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This will allow anyone to impersonate users in your widget. Are you sure?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDisableConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDisableIdentity} disabled={isSaving}>
                {isSaving ? "Disabling..." : "Disable"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
