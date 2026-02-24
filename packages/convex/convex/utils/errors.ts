/**
 * Standardized error codes and messages for consistent error handling
 */

export const ErrorCodes = {
  // Authentication errors
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",

  // Authorization errors
  NOT_AUTHORIZED: "NOT_AUTHORIZED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  NOT_WORKSPACE_MEMBER: "NOT_WORKSPACE_MEMBER",

  // Resource errors
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Validation errors
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",

  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export const ErrorMessages: Record<ErrorCode, string> = {
  NOT_AUTHENTICATED: "Authentication required",
  SESSION_EXPIRED: "Session has expired, please sign in again",
  INVALID_CREDENTIALS: "Invalid email or password",

  NOT_AUTHORIZED: "Not authorized to perform this action",
  PERMISSION_DENIED: "Permission denied",
  NOT_WORKSPACE_MEMBER: "Not a member of this workspace",

  NOT_FOUND: "Resource not found",
  ALREADY_EXISTS: "Resource already exists",
  CONFLICT: "Operation conflicts with existing data",

  INVALID_INPUT: "Invalid input provided",
  MISSING_REQUIRED_FIELD: "Required field is missing",
  INVALID_FORMAT: "Invalid format",

  RATE_LIMITED: "Too many requests, please try again later",

  INTERNAL_ERROR: "An unexpected error occurred",
};

/**
 * Create a standardized error with code and message
 */
export function createError(code: ErrorCode, customMessage?: string): Error {
  const message = customMessage || ErrorMessages[code];
  const error = new Error(message);
  error.name = code;
  return error;
}

/**
 * Throw a standardized not found error
 */
export function throwNotFound(resourceType: string): never {
  throw createError("NOT_FOUND", `${resourceType} not found`);
}

/**
 * Throw a standardized not authenticated error
 */
export function throwNotAuthenticated(): never {
  throw createError("NOT_AUTHENTICATED");
}

/**
 * Throw a standardized permission denied error
 */
export function throwPermissionDenied(permission?: string): never {
  const message = permission ? `Permission denied: ${permission}` : "Permission denied";
  throw createError("PERMISSION_DENIED", message);
}
