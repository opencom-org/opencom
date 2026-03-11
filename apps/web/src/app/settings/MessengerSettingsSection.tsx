"use client";

import { useState, useEffect } from "react";
import { Button, Card } from "@opencom/ui";
import { normalizeUnknownError, type ErrorFeedbackMessage } from "@opencom/web-shared";
import { Palette, Eye } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { ErrorFeedbackBanner } from "@/components/ErrorFeedbackBanner";
import { useMessengerSettingsConvex } from "./hooks/useMessengerSettingsConvex";
import { MessengerSettingsFormFields } from "./MessengerSettingsFormFields";
import { MessengerSettingsPreview } from "./MessengerSettingsPreview";
import {
  buildMessengerSettingsMutationInput,
  createMessengerSettingsFormState,
  type MessengerSettingsFormState,
} from "./messengerSettingsForm";

export function MessengerSettingsSection({
  workspaceId,
}: {
  workspaceId?: Id<"workspaces">;
}): React.JSX.Element | null {
  const {
    deleteLogo,
    generateUploadUrl,
    messengerSettings,
    saveLogo,
    upsertSettings,
  } = useMessengerSettingsConvex(workspaceId);

  const [formState, setFormState] = useState<MessengerSettingsFormState>(() =>
    createMessengerSettingsFormState()
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<ErrorFeedbackMessage | null>(null);

  useEffect(() => {
    if (messengerSettings) {
      setFormState(createMessengerSettingsFormState(messengerSettings));
    }
  }, [messengerSettings]);

  const handleSave = async () => {
    if (!workspaceId) return;
    setErrorFeedback(null);
    setIsSaving(true);
    try {
      await upsertSettings(buildMessengerSettingsMutationInput(workspaceId, formState));
    } catch (error) {
      console.error("Failed to save messenger settings:", error);
      setErrorFeedback(
        normalizeUnknownError(error, {
          fallbackMessage: "Failed to save messenger settings",
          nextAction: "Review your changes and try again.",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;
    setErrorFeedback(null);

    // Validate file size (max 100KB)
    if (file.size > 100 * 1024) {
      setErrorFeedback({
        message: "Logo must be under 100KB.",
        nextAction: "Choose a smaller PNG or JPG and upload again.",
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setErrorFeedback({
        message: "Please upload an image file.",
        nextAction: "Use a PNG or JPG logo.",
      });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const uploadUrl = await generateUploadUrl({ workspaceId });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await response.json();
      await saveLogo({ workspaceId, storageId });

      const reader = new FileReader();
      reader.onload = () => {
        setFormState((current) => ({
          ...current,
          logoPreview: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Failed to upload logo:", error);
      setErrorFeedback(
        normalizeUnknownError(error, {
          fallbackMessage: "Failed to upload logo",
          nextAction: "Try again with a valid image file.",
        })
      );
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!workspaceId) return;
    setErrorFeedback(null);
    try {
      await deleteLogo({ workspaceId });
      setFormState((current) => ({
        ...current,
        logoPreview: null,
      }));
    } catch (error) {
      console.error("Failed to delete logo:", error);
      setErrorFeedback(
        normalizeUnknownError(error, {
          fallbackMessage: "Failed to delete logo",
          nextAction: "Try again in a moment.",
        })
      );
    }
  };

  if (!workspaceId) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Messenger Customization</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
          <Eye className="h-4 w-4 mr-2" />
          {showPreview ? "Hide Preview" : "Preview"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Customize the appearance of your messenger widget and mobile SDK to match your brand.
      </p>
      {errorFeedback && <ErrorFeedbackBanner feedback={errorFeedback} className="mb-4" />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MessengerSettingsFormFields
          formState={formState}
          setFormState={setFormState}
          isSaving={isSaving}
          isUploadingLogo={isUploadingLogo}
          onSave={handleSave}
          onLogoUpload={handleLogoUpload}
          onDeleteLogo={handleDeleteLogo}
        />

        {showPreview && (
          <MessengerSettingsPreview formState={formState} />
        )}
      </div>
    </Card>
  );
}
