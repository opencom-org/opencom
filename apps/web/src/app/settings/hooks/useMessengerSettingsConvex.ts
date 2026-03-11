"use client";

import type { Id } from "@opencom/convex/dataModel";
import type { PublicMessengerSettings } from "@opencom/types";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";
import type { MessengerSettingsFormState } from "../messengerSettingsForm";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type MessengerSettingsRecord = (Partial<PublicMessengerSettings> & {
  logo?: string | null;
}) | null;

type UpsertMessengerSettingsArgs = {
  workspaceId: Id<"workspaces">;
  primaryColor: string;
  backgroundColor: string;
  themeMode: MessengerSettingsFormState["themeMode"];
  launcherPosition: MessengerSettingsFormState["launcherPosition"];
  launcherSideSpacing: number;
  launcherBottomSpacing: number;
  showLauncher: boolean;
  welcomeMessage: string;
  teamIntroduction: string | null;
  showTeammateAvatars: boolean;
  supportedLanguages: string[];
  defaultLanguage: string;
  privacyPolicyUrl: string | null;
  mobileEnabled: boolean;
};

type GenerateLogoUploadUrlArgs = WorkspaceArgs;

type SaveLogoArgs = {
  workspaceId: Id<"workspaces">;
  storageId: string;
};

const MESSENGER_SETTINGS_QUERY_REF = webQueryRef<WorkspaceArgs, MessengerSettingsRecord>(
  "messengerSettings:getOrCreate"
);
const UPSERT_MESSENGER_SETTINGS_REF = webMutationRef<UpsertMessengerSettingsArgs, null>(
  "messengerSettings:upsert"
);
const GENERATE_LOGO_UPLOAD_URL_REF = webMutationRef<GenerateLogoUploadUrlArgs, string>(
  "messengerSettings:generateLogoUploadUrl"
);
const SAVE_LOGO_REF = webMutationRef<SaveLogoArgs, null>("messengerSettings:saveLogo");
const DELETE_LOGO_REF = webMutationRef<WorkspaceArgs, null>("messengerSettings:deleteLogo");

export function useMessengerSettingsConvex(workspaceId?: Id<"workspaces">) {
  return {
    deleteLogo: useWebMutation(DELETE_LOGO_REF),
    generateUploadUrl: useWebMutation(GENERATE_LOGO_UPLOAD_URL_REF),
    messengerSettings: useWebQuery(
      MESSENGER_SETTINGS_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    saveLogo: useWebMutation(SAVE_LOGO_REF),
    upsertSettings: useWebMutation(UPSERT_MESSENGER_SETTINGS_REF),
  };
}
