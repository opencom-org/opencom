import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import { MessengerSettingsSection } from "./MessengerSettingsSection";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("@opencom/convex", () => ({
  api: {
    messengerSettings: {
      getOrCreate: "messengerSettings.getOrCreate",
      upsert: "messengerSettings.upsert",
      generateLogoUploadUrl: "messengerSettings.generateLogoUploadUrl",
      saveLogo: "messengerSettings.saveLogo",
      deleteLogo: "messengerSettings.deleteLogo",
    },
  },
}));

describe("MessengerSettingsSection error feedback", () => {
  const workspaceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as any;
  const messengerSettingsFixture = {
    primaryColor: "#792cd4",
    backgroundColor: "#792cd4",
    themeMode: "system",
    launcherPosition: "right",
    launcherSideSpacing: 20,
    launcherBottomSpacing: 20,
    showLauncher: true,
    welcomeMessage: "Hi there! How can we help you today?",
    teamIntroduction: "",
    showTeammateAvatars: true,
    supportedLanguages: ["en"],
    defaultLanguage: "en",
    privacyPolicyUrl: null,
    mobileEnabled: true,
    logo: null,
  } as const;
  let upsertMock: ReturnType<typeof vi.fn>;

  const resolveFunctionPath = (ref: unknown): string => {
    if (typeof ref === "string") {
      return ref;
    }

    if (!ref || typeof ref !== "object") {
      return "";
    }

    const maybeRef = ref as {
      functionName?: string;
      reference?: { functionName?: string };
      name?: string;
      referencePath?: string;
      function?: { name?: string };
      [key: string]: unknown;
    };

    const symbolFunctionName = Object.getOwnPropertySymbols(ref).find((symbol) =>
      String(symbol).includes("functionName")
    );

    const symbolValue = symbolFunctionName
      ? (ref as Record<symbol, unknown>)[symbolFunctionName]
      : undefined;

    return (
      (typeof symbolValue === "string" ? symbolValue : undefined) ??
      maybeRef.functionName ??
      maybeRef.reference?.functionName ??
      maybeRef.name ??
      maybeRef.referencePath ??
      maybeRef.function?.name ??
      ""
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    upsertMock = vi.fn().mockResolvedValue(undefined);

    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;
    mockedUseMutation.mockImplementation((mutationRef: unknown) => {
      const functionPath = resolveFunctionPath(mutationRef);

      if (
        functionPath === "messengerSettings:upsert" ||
        functionPath === "messengerSettings.upsert"
      ) {
        return upsertMock;
      }

      return vi.fn().mockResolvedValue(undefined);
    });

    const mockedUseQuery = useQuery as unknown as ReturnType<typeof vi.fn>;
    mockedUseQuery.mockImplementation((_: unknown, args: unknown) => {
      if (args === "skip") {
        return undefined;
      }
      if (args && typeof args === "object" && "workspaceId" in (args as Record<string, unknown>)) {
        return messengerSettingsFixture;
      }
      return undefined;
    });
  });

  it("shows actionable feedback when logo validation fails", async () => {
    render(<MessengerSettingsSection workspaceId={workspaceId} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const oversizedFile = new File([new Uint8Array(100 * 1024 + 1)], "logo.png", {
      type: "image/png",
    });
    fireEvent.change(fileInput!, {
      target: { files: [oversizedFile] },
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Logo must be under 100KB.");
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a smaller PNG or JPG and upload again."
    );
  });

  it("maps unknown save errors through shared normalization", async () => {
    upsertMock.mockRejectedValue(new Error("Service unavailable"));

    render(<MessengerSettingsSection workspaceId={workspaceId} />);
    fireEvent.click(screen.getByRole("button", { name: /save messenger settings/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Service unavailable");
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Review your changes and try again.");
  });
});
