import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WidgetInstallGuide } from "../WidgetInstallGuide";

describe("WidgetInstallGuide", () => {
  it("includes onboarding verification token in snippet when provided", () => {
    const { container } = render(
      <WidgetInstallGuide
        convexUrl="https://example.convex.cloud"
        workspaceId="abc123workspace"
        onboardingVerificationToken="onb_test_token"
        isOpenByDefault
      />
    );

    const basicSnippet = container.querySelector("pre code")?.textContent ?? "";

    expect(basicSnippet).toContain('data-opencom-convex-url="https://example.convex.cloud"');
    expect(basicSnippet).toContain('data-opencom-workspace-id="abc123workspace"');
    expect(basicSnippet).toContain('data-opencom-onboarding-verification-token="onb_test_token"');
    expect(
      screen.getByText(/includes a one-time onboarding verification token/i)
    ).toBeInTheDocument();
  });

  it("switches to Next.js App Router snippet", () => {
    const { container } = render(
      <WidgetInstallGuide
        convexUrl="https://example.convex.cloud"
        workspaceId="abc123workspace"
        isOpenByDefault
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Next.js App Router" }));
    const snippet = container.querySelector("pre code")?.textContent ?? "";

    expect(snippet).toContain('import Script from "next/script"');
    expect(snippet).toContain("<OpencomWidgetScript />");
    expect(snippet).toContain('data-opencom-convex-url="https://example.convex.cloud"');
  });

  it("supports custom heading content for wizard usage", () => {
    render(
      <WidgetInstallGuide
        convexUrl="https://example.convex.cloud"
        workspaceId="abc123workspace"
        isOpenByDefault
        title="Step 1: Install snippet"
        description="Copy this snippet into your app shell"
      />
    );

    expect(screen.getByText("Step 1: Install snippet")).toBeInTheDocument();
    expect(screen.getByText("Copy this snippet into your app shell")).toBeInTheDocument();
  });
});
