/**
 * Structured logging utilities for Convex functions
 * Provides consistent log formatting and level-based filtering
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Default to "info" level, can be overridden via environment variable
const getConfiguredLogLevel = (): LogLevel => {
  // In Convex, environment variables are accessed at runtime
  // Default to "info" for production, "debug" for development
  return "info";
};

const currentLogLevel = getConfiguredLogLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLogLevel];
}

interface LogContext {
  module?: string;
  action?: string;
  workspaceId?: string;
  visitorId?: string;
  userId?: string;
  conversationId?: string;
  [key: string]: unknown;
}

function formatLogMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

/**
 * Structured logger for Convex functions
 */
export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog("debug")) {
      console.log(formatLogMessage("debug", message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog("info")) {
      console.log(formatLogMessage("info", message, context));
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog("warn")) {
      console.warn(formatLogMessage("warn", message, context));
    }
  },

  error(message: string, context?: LogContext & { error?: unknown }): void {
    if (shouldLog("error")) {
      const errorContext = context?.error
        ? {
            ...context,
            error: context.error instanceof Error ? context.error.message : String(context.error),
          }
        : context;
      console.error(formatLogMessage("error", message, errorContext));
    }
  },

  /**
   * Log with automatic context extraction from common Convex patterns
   */
  withContext(baseContext: LogContext) {
    return {
      debug: (message: string, additionalContext?: LogContext) =>
        logger.debug(message, { ...baseContext, ...additionalContext }),
      info: (message: string, additionalContext?: LogContext) =>
        logger.info(message, { ...baseContext, ...additionalContext }),
      warn: (message: string, additionalContext?: LogContext) =>
        logger.warn(message, { ...baseContext, ...additionalContext }),
      error: (message: string, additionalContext?: LogContext & { error?: unknown }) =>
        logger.error(message, { ...baseContext, ...additionalContext }),
    };
  },
};

/**
 * Create a logger instance for a specific module
 */
export function createModuleLogger(moduleName: string) {
  return logger.withContext({ module: moduleName });
}
