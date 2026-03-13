"use client";

import type { Id } from "@opencom/convex/dataModel";

export type BlockType = "rule" | "wait" | "email" | "push" | "chat" | "post" | "carousel" | "tag";
export type ConnectionCondition = "yes" | "no" | "default";

export interface SeriesBlock {
  _id: string;
  type: BlockType;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface SeriesConnection {
  _id: string;
  fromBlockId: string;
  toBlockId: string;
  condition?: ConnectionCondition;
}

export interface ReadinessIssue {
  code: string;
  message: string;
  remediation: string;
  blockId?: string;
  connectionId?: string;
}

export interface ReadinessResult {
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
  isReady: boolean;
}

export interface SeriesStats {
  total: number;
  active: number;
  waiting: number;
  completed: number;
  exited: number;
  goalReached: number;
  failed: number;
}

export function formatRuleText(value: unknown): string {
  if (!value) {
    return "";
  }
  return JSON.stringify(value, null, 2);
}

export function parseRuleText(
  value: string,
  label: string
): { value?: Record<string, unknown>; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: undefined };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { error: `${label} must be a JSON object.` };
    }
    return { value: parsed };
  } catch {
    return { error: `${label} must be valid JSON.` };
  }
}

export function tryParseActivationError(error: unknown): {
  code?: string;
  blockers?: ReadinessIssue[];
  warnings?: ReadinessIssue[];
  message: string;
} {
  const raw = error instanceof Error ? error.message : String(error);
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        code?: string;
        blockers?: ReadinessIssue[];
        warnings?: ReadinessIssue[];
        message?: string;
      };
      return {
        code: parsed.code,
        blockers: parsed.blockers,
        warnings: parsed.warnings,
        message: parsed.message ?? raw,
      };
    } catch {
      return { message: raw };
    }
  }

  return { message: raw };
}

export function toLocalDateTimeInput(timestamp?: number): string {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  const tzOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export function fromLocalDateTimeInput(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function getDefaultConfig(type: BlockType): Record<string, unknown> {
  switch (type) {
    case "wait":
      return { waitType: "duration", waitDuration: 1, waitUnit: "days" };
    case "email":
      return { subject: "Email subject", body: "Email content" };
    case "push":
      return { title: "Push title", body: "Push message" };
    case "chat":
      return { body: "Chat message" };
    case "tag":
      return { tagAction: "add", tagName: "" };
    case "post":
      return { body: "Post content" };
    case "carousel":
      return { body: "Carousel content" };
    default:
      return {};
  }
}

export type SeriesId = Id<"series">;
