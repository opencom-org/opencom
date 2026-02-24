import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AUTH_REQUEST_TIMEOUT_MS } from "@/lib/authUi";

const {
  useAuthOptionalMock,
  useBackendMock,
  routerPushMock,
  routerReplaceMock,
  clearBackendMock,
  loginMock,
  loginWithOtpMock,
  sendOtpCodeMock,
} = vi.hoisted(() => ({
  useAuthOptionalMock: vi.fn(),
  useBackendMock: vi.fn(),
  routerPushMock: vi.fn(),
  routerReplaceMock: vi.fn(),
  clearBackendMock: vi.fn(),
  loginMock: vi.fn(),
  loginWithOtpMock: vi.fn(),
  sendOtpCodeMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock,
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

import LoginPage from "./page";

function buildAuthState(overrides: Record<string, unknown> = {}) {
  return {
    login: loginMock,
    loginWithOTP: loginWithOtpMock,
    sendOTPCode: sendOtpCodeMock,
    isAuthenticated: false,
    isLoading: false,
    defaultHomePath: "/inbox",
    isHomeRouteLoading: false,
    ...overrides,
  };
}

function renderLoginPage(authMethods: Array<"password" | "otp"> = ["password", "otp"]) {
  useAuthOptionalMock.mockReturnValue(buildAuthState());
  useBackendMock.mockReturnValue({
    activeBackend: {
      name: "Test Backend",
      authMethods,
    },
    clearBackend: clearBackendMock,
  });

  return render(<LoginPage />);
}

describe("login auth UX safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginMock.mockResolvedValue(undefined);
    loginWithOtpMock.mockResolvedValue(undefined);
    sendOtpCodeMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prevents repeated password submits while request is in-flight", async () => {
    let resolveLogin: (() => void) | undefined;
    loginMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        })
    );

    renderLoginPage(["password"]);

    fireEvent.change(screen.getByLabelText("Email", { exact: true }), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "SuperSecret!" },
    });

    const submitButton = screen.getByRole("button", { name: /^sign in$/i });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    expect(loginMock).toHaveBeenCalledTimes(1);
    expect(submitButton).toBeDisabled();

    resolveLogin?.();

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith("/");
    });
  });

  it("clears password loading state on timeout and allows retry", async () => {
    vi.useFakeTimers();
    loginMock.mockImplementation(() => new Promise<void>(() => {}));

    renderLoginPage(["password"]);

    fireEvent.change(screen.getByLabelText("Email", { exact: true }), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "SuperSecret!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS + 10);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(
        screen.getByText(/sign-in is taking longer than expected\. please try again\./i)
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
  });

  it("clears OTP send loading state on timeout and allows retry", async () => {
    vi.useFakeTimers();
    sendOtpCodeMock.mockImplementation(() => new Promise<void>(() => {}));

    renderLoginPage(["password", "otp"]);

    fireEvent.change(screen.getByLabelText("Email", { exact: true }), {
      target: { value: "otp-user@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS + 10);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(
        screen.getByText(/sending your verification code timed out\. please try again\./i)
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /send verification code/i })).toBeEnabled();
  });

  it("shows friendly account-not-found guidance with direct signup CTA", async () => {
    loginMock.mockRejectedValue(new Error("Invalid credentials"));

    renderLoginPage(["password"]);

    fireEvent.change(screen.getByLabelText("Email", { exact: true }), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "bad-password" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          /we couldn't find an account matching that email\. create one to get started\./i
        )
      ).toBeInTheDocument();
    });

    const createAccountLink = screen.getByRole("link", { name: /create an account/i });
    expect(createAccountLink).toHaveAttribute("href", "/signup");
    expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument();
  });

  it("prevents repeated OTP send requests while in-flight", async () => {
    let resolveSend: (() => void) | undefined;
    sendOtpCodeMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        })
    );

    renderLoginPage(["password", "otp"]);

    fireEvent.change(screen.getByLabelText("Email", { exact: true }), {
      target: { value: "otp-user@example.com" },
    });

    const sendButton = screen.getByRole("button", {
      name: /send verification code/i,
    });

    fireEvent.click(sendButton);
    fireEvent.click(sendButton);

    expect(sendOtpCodeMock).toHaveBeenCalledTimes(1);
    expect(sendButton).toBeDisabled();

    resolveSend?.();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /enter verification code/i })).toBeInTheDocument();
    });
  });

  it("prevents repeated OTP verify submits while request is in-flight", async () => {
    let resolveVerify: (() => void) | undefined;
    loginWithOtpMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveVerify = resolve;
        })
    );

    renderLoginPage(["password", "otp"]);

    fireEvent.change(screen.getByLabelText("Email", { exact: true }), {
      target: { value: "otp-user@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /enter verification code/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("000000"), {
      target: { value: "123456" },
    });

    const verifyButton = screen.getByRole("button", { name: /verify code/i });
    fireEvent.click(verifyButton);
    fireEvent.click(verifyButton);

    expect(loginWithOtpMock).toHaveBeenCalledTimes(1);
    expect(verifyButton).toBeDisabled();

    resolveVerify?.();

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith("/");
    });
  });
});
