/**
 * onAiGeneration — billing hook (self-hosted no-op stub)
 *
 * Called from aiAgentActions.ts at three points in the AI generation pipeline.
 * The private overlay replaces this file with real implementations.
 *
 * Self-hosted: all no-ops — AI always available, no headers, nothing tracked.
 */
import type { Id } from "../_generated/dataModel";

export interface AiBlockResult {
  blocked: true;
  reason: string;
  handoffMessageId: Id<"messages"> | null;
}

export interface AiAllowedResult {
  blocked: false;
}

export type AiCheckResult = AiBlockResult | AiAllowedResult;

export async function checkAiAllowed(
  _ctx: { runQuery: unknown; runMutation: unknown },
  _workspaceId: Id<"workspaces">,
  _conversationId: Id<"conversations">,
  _visitorId: Id<"visitors"> | undefined,
  _sessionToken: string | undefined
): Promise<AiCheckResult> {
  return { blocked: false };
}

export async function getAiGatewayHeaders(
  _ctx: { runQuery: unknown },
  _workspaceId: Id<"workspaces">
): Promise<Record<string, string>> {
  return {};
}

export async function trackAiUsage(
  _ctx: { runQuery: unknown; runMutation: unknown },
  _workspaceId: Id<"workspaces">,
  _tokensUsed: number
): Promise<void> {
  // Self-hosted no-op
}
