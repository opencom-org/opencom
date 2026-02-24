export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

const AUTH_REQUEST_TIMEOUT_CODE = "AUTH_REQUEST_TIMEOUT";

const ACCOUNT_NOT_FOUND_PATTERNS = [
  "invalid credentials",
  "account not found",
  "no account",
  "user not found",
  "could not find account",
  "cannot find account",
];

const INVALID_OTP_PATTERNS = [
  "invalid verification code",
  "invalid code",
  "code is invalid",
  "expired",
];

export type AuthUiErrorCode = "timeout" | "account_not_found" | "invalid_code" | "generic";

export type AuthUiError = {
  code: AuthUiErrorCode;
  message: string;
  showSignupCta?: boolean;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "";
}

function isTimeoutError(error: unknown): boolean {
  return toErrorMessage(error) === AUTH_REQUEST_TIMEOUT_CODE;
}

function containsAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

export async function withAuthRequestTimeout<T>(
  request: () => Promise<T>,
  timeoutMs: number = AUTH_REQUEST_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(AUTH_REQUEST_TIMEOUT_CODE));
    }, timeoutMs);
  });

  try {
    return await Promise.race([request(), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function mapPasswordSignInError(error: unknown): AuthUiError {
  if (isTimeoutError(error)) {
    return {
      code: "timeout",
      message: "Sign-in is taking longer than expected. Please try again.",
    };
  }

  const normalized = toErrorMessage(error).toLowerCase();
  if (containsAnyPattern(normalized, ACCOUNT_NOT_FOUND_PATTERNS)) {
    return {
      code: "account_not_found",
      message: "We couldn't find an account matching that email. Create one to get started.",
      showSignupCta: true,
    };
  }

  return {
    code: "generic",
    message: "We couldn't sign you in right now. Check your details and try again.",
  };
}

export function mapOtpSendError(error: unknown): AuthUiError {
  if (isTimeoutError(error)) {
    return {
      code: "timeout",
      message: "Sending your verification code timed out. Please try again.",
    };
  }

  return {
    code: "generic",
    message: "We couldn't send a verification code right now. Please try again.",
  };
}

export function mapOtpVerifyError(error: unknown): AuthUiError {
  if (isTimeoutError(error)) {
    return {
      code: "timeout",
      message: "Code verification timed out. Please try again.",
    };
  }

  const normalized = toErrorMessage(error).toLowerCase();
  if (containsAnyPattern(normalized, INVALID_OTP_PATTERNS)) {
    return {
      code: "invalid_code",
      message: "That verification code is invalid or expired. Request a new one and try again.",
    };
  }

  return {
    code: "generic",
    message: "We couldn't verify that code right now. Please try again.",
  };
}

export function mapSignupError(error: unknown): AuthUiError {
  if (isTimeoutError(error)) {
    return {
      code: "timeout",
      message: "Sign-up is taking longer than expected. Please try again.",
    };
  }

  return {
    code: "generic",
    message: "We couldn't create your account right now. Please try again.",
  };
}
