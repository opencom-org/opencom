"use client";

import { Button, Card, Input } from "@opencom/ui";
import { Shield } from "lucide-react";

interface SignupAuthSectionProps {
  signupMode: "invite-only" | "domain-allowlist";
  setSignupMode: (mode: "invite-only" | "domain-allowlist") => void;
  allowedDomains: string;
  setAllowedDomains: (value: string) => void;
  authMethodPassword: boolean;
  setAuthMethodPassword: (value: boolean) => void;
  authMethodOtp: boolean;
  setAuthMethodOtp: (value: boolean) => void;
  isSavingSignup: boolean;
  onSave: () => Promise<void>;
}

export function SignupAuthSection({
  signupMode,
  setSignupMode,
  allowedDomains,
  setAllowedDomains,
  authMethodPassword,
  setAuthMethodPassword,
  authMethodOtp,
  setAuthMethodOtp,
  isSavingSignup,
  onSave,
}: SignupAuthSectionProps): React.JSX.Element {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Signup Settings</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Control how new users can join this workspace.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Signup Mode</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSignupMode("invite-only")}
              className={`flex-1 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                signupMode === "invite-only"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-input"
              }`}
            >
              Invite Only
            </button>
            <button
              type="button"
              onClick={() => setSignupMode("domain-allowlist")}
              className={`flex-1 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                signupMode === "domain-allowlist"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-input"
              }`}
            >
              Domain Allowlist
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {signupMode === "invite-only"
              ? "Only users you invite can join this workspace."
              : "Users with emails from allowed domains can self-signup."}
          </p>
        </div>

        {signupMode === "domain-allowlist" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Allowed Domains</label>
            <Input
              value={allowedDomains}
              onChange={(e) => setAllowedDomains(e.target.value)}
              placeholder="example.com, company.org"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list of email domains (e.g., example.com, company.org)
            </p>
          </div>
        )}

        <div className="space-y-2 pt-4 border-t">
          <label className="text-sm font-medium">Authentication Methods</label>
          <p className="text-xs text-muted-foreground mb-2">
            Choose which login methods are available to users.
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={authMethodPassword}
                onChange={(e) => setAuthMethodPassword(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Password login</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={authMethodOtp}
                onChange={(e) => setAuthMethodOtp(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Email code (magic link)</span>
            </label>
          </div>
        </div>

        <Button onClick={() => void onSave()} disabled={isSavingSignup}>
          {isSavingSignup ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </Card>
  );
}
