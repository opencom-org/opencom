import { describe, expect, it } from "vitest";
import { createMessengerSettingsFormState, toggleMessengerLanguage } from "./messengerSettingsForm";

describe("messengerSettingsForm", () => {
  it("builds form state from defaults and normalizes nullable strings", () => {
    const state = createMessengerSettingsFormState({
      teamIntroduction: null,
      privacyPolicyUrl: null,
      logo: null,
    });

    expect(state.primaryColor).toBe("#792cd4");
    expect(state.teamIntroduction).toBe("");
    expect(state.privacyPolicyUrl).toBe("");
    expect(state.logoPreview).toBeNull();
    expect(state.supportedLanguages).toEqual(["en"]);
  });

  it("keeps at least one language and reassigns the default language when removing it", () => {
    const state = createMessengerSettingsFormState({
      supportedLanguages: ["en", "fr"],
      defaultLanguage: "fr",
    });

    const removedDefault = toggleMessengerLanguage(state, "fr");
    expect(removedDefault.supportedLanguages).toEqual(["en"]);
    expect(removedDefault.defaultLanguage).toBe("en");

    const singleLanguage = toggleMessengerLanguage(
      createMessengerSettingsFormState({
        supportedLanguages: ["en"],
        defaultLanguage: "en",
      }),
      "en"
    );
    expect(singleLanguage.supportedLanguages).toEqual(["en"]);
    expect(singleLanguage.defaultLanguage).toBe("en");
  });
});
