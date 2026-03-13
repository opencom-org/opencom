"use client";

import { Button, Card, Input } from "@opencom/ui";
import { Copy, Mail } from "lucide-react";

interface EmailChannelSectionProps {
  emailEnabled: boolean;
  setEmailEnabled: (value: boolean) => void;
  forwardingAddress?: string;
  emailFromName: string;
  setEmailFromName: (value: string) => void;
  emailFromEmail: string;
  setEmailFromEmail: (value: string) => void;
  emailSignature: string;
  setEmailSignature: (value: string) => void;
  isSavingEmail: boolean;
  onSave: () => Promise<void>;
}

export function EmailChannelSection({
  emailEnabled,
  setEmailEnabled,
  forwardingAddress,
  emailFromName,
  setEmailFromName,
  emailFromEmail,
  setEmailFromEmail,
  emailSignature,
  setEmailSignature,
  isSavingEmail,
  onSave,
}: EmailChannelSectionProps): React.JSX.Element {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Email Channel</h2>
      </div>

      <div className="space-y-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={emailEnabled}
            onChange={(e) => setEmailEnabled(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm font-medium">Enable Email Channel</span>
        </label>

        {forwardingAddress && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <label className="text-sm font-medium">Forwarding Address</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="bg-background px-3 py-2 rounded font-mono text-sm flex-1 border">
                {forwardingAddress}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(forwardingAddress);
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Forward emails to this address to receive them in your inbox.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">From Name</label>
          <Input
            value={emailFromName}
            onChange={(e) => setEmailFromName(e.target.value)}
            placeholder="Support Team"
          />
          <p className="text-xs text-muted-foreground">
            The name that appears in outbound emails.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">From Email</label>
          <Input
            value={emailFromEmail}
            onChange={(e) => setEmailFromEmail(e.target.value)}
            placeholder="support@yourcompany.com"
          />
          <p className="text-xs text-muted-foreground">
            The email address used for outbound emails. Must be verified with your email provider.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Email Signature</label>
          <textarea
            value={emailSignature}
            onChange={(e) => setEmailSignature(e.target.value)}
            placeholder={"Best regards,\nThe Support Team"}
            className="w-full px-3 py-2 border rounded-md text-sm min-h-[80px] bg-background"
          />
          <p className="text-xs text-muted-foreground">
            Automatically appended to all outbound emails.
          </p>
        </div>

        <Button onClick={() => void onSave()} disabled={isSavingEmail}>
          {isSavingEmail ? "Saving..." : "Save Email Settings"}
        </Button>
      </div>
    </Card>
  );
}
