import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AUTH_REQUEST_TIMEOUT_MS } from "@/lib/authUi";

const {
  useAuthOptionalMock,
  useBackendMock,
  routerPushMock,
  signupMock,
  sendOTPCodeMock,
  loginWithOTPMock,
  completeSignupProfileMock,
} = vi.hoisted(() => ({
  useAuthOptionalMock: vi.fn(),
  useBackendMock: vi.fn(),
  routerPushMock: vi.fn(),
  signupMock: vi.fn(),
  sendOTPCodeMock: vi.fn(),
  loginWithOTPMock: vi.fn(),
  completeSignupProfileMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuthOptional: () => useAuthOptionalMock(),
}));

vi.mock("@/contexts/BackendContext", () => ({
  useBackend: () => useBackendMock(),
}));

vi.mock("@/components/BackendSelector", () => ({
  BackendSelector: () => <div>Backend Selector</div>,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import SignupPage from "./page";

function renderSignupPage() {
  useAuthOptionalMock.mockReturnValue({
    signup: signupMock,
    sendOTPCode: sendOTPCodeMock,
    loginWithOTP: loginWithOTPMock,
    completeSignupProfile: completeSignupProfileMock,
  });

  useBackendMock.mockReturnValue({
    activeBackend: {
      name: "Test Backend",
      authMethods: ["password", "otp"],
    },
  });

  return render(<SignupPage />);
}

describe("signup auth UX safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signupMock.mockResolvedValue(undefined);
    sendOTPCodeMock.mockResolvedValue(undefined);
    loginWithOTPMock.mockResolvedValue(undefined);
    completeSignupProfileMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prevents repeated signup submits while request is in-flight", async () => {
    let resolveSignup: (() => void) | undefined;
    signupMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignup = resolve;
        })
    );

    renderSignupPage();

    fireEvent.change(screen.getByLabelText("Name", { exact: true }), {
      target: { value: "Auth User" },
    });
    fireEvent.change(screen.getByLabelText("Email", { exact: true }), {
      target: { value: "new-user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Workspace name (optional)", { exact: true }), {
      target: { value: "Acme Workspace" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^password$/i }));
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "SuperSecret!" },
    });

    const submitButton = screen.getByRole("button", { name: /^create account$/i });

    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    expect(signupMock).toHaveBeenCalledTimes(1);
    expect(signupMock).toHaveBeenCalledWith(
      "new-user@example.com",
      "SuperSecret!",
      "Auth User",
      "Acme Workspace"
    );
    expect(submitButton).toBeDisabled();

    resolveSignup?.();

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith("/");
    });
  });

  it("clears signup loading state on timeout and allows retry", async () => {
    vi.useFakeTimers();
    signupMock.mockImplementation(() => new Promise<void>(() => {}));

    renderSignupPage();

    fireEvent.change(screen.getByLabelText("Name", { exact: true }), {
      target: { value: "Auth User" },
    });
    fireEvent.change(screen.getByLabelText("Email", { exact: true }), {
      target: { value: "new-user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^password$/i }));
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "SuperSecret!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));
    expect(screen.getByRole("button", { name: /creating account/i })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS + 10);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(
        screen.getByText(/sign-up is taking longer than expected\. please try again\./i)
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /^create account$/i })).toBeEnabled();
  });

  it("supports email-code signup and persists profile details after verification", async () => {
    renderSignupPage();

    fireEvent.change(screen.getByLabelText("Name", { exact: true }), {
      target: { value: "OTP User" },
    });
    fireEvent.change(screen.getByLabelText("Email", { exact: true }), {
      target: { value: "otp-user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Workspace name (optional)", { exact: true }), {
      target: { value: "OTP Workspace" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^send verification code$/i }));

    await waitFor(() => {
      expect(sendOTPCodeMock).toHaveBeenCalledWith("otp-user@example.com");
    });

    fireEvent.change(screen.getByPlaceholderText("000000"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify & create account$/i }));

    await waitFor(() => {
      expect(loginWithOTPMock).toHaveBeenCalledWith("otp-user@example.com", "123456");
      expect(completeSignupProfileMock).toHaveBeenCalledWith("OTP User", "OTP Workspace");
      expect(routerPushMock).toHaveBeenCalledWith("/");
    });
  });
});
