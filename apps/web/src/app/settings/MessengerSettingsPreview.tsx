import type { MessengerSettingsFormState } from "./messengerSettingsForm";

interface MessengerSettingsPreviewProps {
  formState: MessengerSettingsFormState;
}

export function MessengerSettingsPreview({
  formState,
}: MessengerSettingsPreviewProps): React.JSX.Element {
  return (
    <div className="lg:sticky lg:top-6">
      <div className="border rounded-lg p-4 bg-gray-50">
        <p className="text-xs text-muted-foreground mb-3 text-center">Live Preview</p>
        <div
          className="relative bg-white rounded-lg shadow-lg overflow-hidden"
          style={{ height: "400px" }}
        >
          <div className="p-4 text-white" style={{ backgroundColor: formState.backgroundColor }}>
            <div className="flex items-center gap-3">
              {formState.logoPreview && (
                <img
                  src={formState.logoPreview}
                  alt="Logo"
                  className="w-8 h-8 rounded object-contain bg-white/20"
                />
              )}
              <span className="font-semibold">Messages</span>
            </div>
          </div>

          <div className="p-4">
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: `${formState.primaryColor}15` }}
            >
              {formState.welcomeMessage}
            </div>
            {formState.teamIntroduction && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {formState.teamIntroduction}
              </p>
            )}
          </div>

          <div
            className="absolute w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg"
            style={{
              backgroundColor: formState.primaryColor,
              bottom: `${formState.launcherBottomSpacing}px`,
              [formState.launcherPosition]: `${formState.launcherSideSpacing}px`,
            }}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
