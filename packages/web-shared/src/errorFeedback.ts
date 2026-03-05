export interface ErrorFeedbackMessage {
  message: string;
  nextAction?: string;
}

export interface NormalizeUnknownErrorOptions {
  fallbackMessage: string;
  nextAction?: string;
}

function sanitizeMessage(message: string | null | undefined): string | null {
  if (!message) {
    return null;
  }
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readObjectMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? sanitizeMessage(message) : null;
}

function readUnknownErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return sanitizeMessage(error.message);
  }
  if (typeof error === "string") {
    return sanitizeMessage(error);
  }
  return readObjectMessage(error);
}

export function normalizeUnknownError(
  error: unknown,
  options: NormalizeUnknownErrorOptions
): ErrorFeedbackMessage {
  const message = readUnknownErrorMessage(error) ?? sanitizeMessage(options.fallbackMessage) ?? "Unexpected error";
  const nextAction = sanitizeMessage(options.nextAction) ?? undefined;
  return {
    message,
    nextAction,
  };
}
