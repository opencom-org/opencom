"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Bell } from "lucide-react";
import { Button, Card } from "@opencom/ui";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { loadInboxCuePreferences, saveInboxCuePreferences } from "@/lib/inboxNotificationCues";

interface NotificationSettingsSectionProps {
  workspaceId?: Id<"workspaces">;
  isAdmin: boolean;
}

export function NotificationSettingsSection({
  workspaceId,
  isAdmin,
}: NotificationSettingsSectionProps): React.JSX.Element | null {
  const myPreferences = useQuery(
    api.notificationSettings.getMyPreferences,
    workspaceId ? { workspaceId } : "skip"
  );

  const workspaceDefaults = useQuery(
    api.notificationSettings.getWorkspaceDefaults,
    workspaceId && isAdmin ? { workspaceId } : "skip"
  );

  const updateMyPreferences = useMutation(api.notificationSettings.updateMyPreferences);
  const updateWorkspaceDefaults = useMutation(api.notificationSettings.updateWorkspaceDefaults);

  const [myEmailEnabled, setMyEmailEnabled] = useState(true);
  const [myPushEnabled, setMyPushEnabled] = useState(true);
  const [savingMine, setSavingMine] = useState(false);

  const [defaultEmailEnabled, setDefaultEmailEnabled] = useState(true);
  const [defaultPushEnabled, setDefaultPushEnabled] = useState(true);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [savingCues, setSavingCues] = useState(false);

  useEffect(() => {
    if (myPreferences) {
      setMyEmailEnabled(myPreferences.effective.newVisitorMessageEmail);
      setMyPushEnabled(myPreferences.effective.newVisitorMessagePush);
    }
  }, [myPreferences]);

  useEffect(() => {
    if (workspaceDefaults) {
      setDefaultEmailEnabled(workspaceDefaults.newVisitorMessageEmail);
      setDefaultPushEnabled(workspaceDefaults.newVisitorMessagePush);
    }
  }, [workspaceDefaults]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const cuePreferences = loadInboxCuePreferences(window.localStorage);
    setBrowserNotificationsEnabled(cuePreferences.browserNotifications);
    setSoundEnabled(cuePreferences.sound);
  }, []);

  if (!workspaceId) {
    return null;
  }

  const handleSaveMyPreferences = async () => {
    if (!workspaceId) {
      return;
    }

    setSavingMine(true);
    try {
      await updateMyPreferences({
        workspaceId,
        newVisitorMessageEmail: myEmailEnabled,
        newVisitorMessagePush: myPushEnabled,
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save notification preferences");
    } finally {
      setSavingMine(false);
    }
  };

  const handleSaveWorkspaceDefaults = async () => {
    if (!workspaceId) {
      return;
    }

    setSavingDefaults(true);
    try {
      await updateWorkspaceDefaults({
        workspaceId,
        newVisitorMessageEmail: defaultEmailEnabled,
        newVisitorMessagePush: defaultPushEnabled,
      });
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to save workspace notification defaults"
      );
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleSaveCuePreferences = async () => {
    if (typeof window === "undefined") {
      return;
    }

    setSavingCues(true);
    try {
      if (
        browserNotificationsEnabled &&
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        await Notification.requestPermission();
      }

      saveInboxCuePreferences(
        {
          browserNotifications: browserNotificationsEnabled,
          sound: soundEnabled,
        },
        window.localStorage
      );
    } finally {
      setSavingCues(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Notifications</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Configure which message events notify you and which channels are used.
      </p>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">My Message Notifications</h3>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={myEmailEnabled}
            onChange={(e) => setMyEmailEnabled(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm">Email me on new visitor messages</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={myPushEnabled}
            onChange={(e) => setMyPushEnabled(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm">Send push on new visitor messages</span>
        </label>

        <Button onClick={handleSaveMyPreferences} disabled={savingMine}>
          {savingMine ? "Saving..." : "Save My Preferences"}
        </Button>
      </div>

      <div className="mt-6 pt-6 border-t space-y-3">
        <h3 className="text-sm font-medium">Web Inbox Attention Cues</h3>
        <p className="text-xs text-muted-foreground">
          Control optional browser/sound cues for new inbox activity while you are away from the
          active thread.
        </p>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={browserNotificationsEnabled}
            onChange={(e) => setBrowserNotificationsEnabled(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm">Browser notifications</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => setSoundEnabled(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm">Play sound cue</span>
        </label>

        <Button onClick={handleSaveCuePreferences} disabled={savingCues}>
          {savingCues ? "Saving..." : "Save Web Cue Preferences"}
        </Button>
      </div>

      {isAdmin && (
        <div className="mt-6 pt-6 border-t space-y-3">
          <h3 className="text-sm font-medium">Workspace Defaults</h3>
          <p className="text-xs text-muted-foreground">
            New members use these defaults until they configure their own preferences.
          </p>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={defaultEmailEnabled}
              onChange={(e) => setDefaultEmailEnabled(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Default: email on new visitor messages</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={defaultPushEnabled}
              onChange={(e) => setDefaultPushEnabled(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Default: push on new visitor messages</span>
          </label>

          <Button onClick={handleSaveWorkspaceDefaults} disabled={savingDefaults}>
            {savingDefaults ? "Saving..." : "Save Workspace Defaults"}
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-6">
        Push delivery also checks per-device token enablement when tokens are registered.
      </p>
    </Card>
  );
}
