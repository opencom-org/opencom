import { v } from "convex/values";

export const AUTOMATION_SCOPES = [
  "conversations.read",
  "conversations.write",
  "messages.read",
  "messages.write",
  "visitors.read",
  "visitors.write",
  "tickets.read",
  "tickets.write",
  "events.read",
  "events.write",
  "articles.read",
  "articles.write",
  "collections.read",
  "collections.write",
  "outbound.read",
  "outbound.write",
  "webhooks.manage",
  "claims.manage",
] as const;

export type AutomationScope = (typeof AUTOMATION_SCOPES)[number];

export const automationScopeValidator = v.union(
  v.literal("conversations.read"),
  v.literal("conversations.write"),
  v.literal("messages.read"),
  v.literal("messages.write"),
  v.literal("visitors.read"),
  v.literal("visitors.write"),
  v.literal("tickets.read"),
  v.literal("tickets.write"),
  v.literal("events.read"),
  v.literal("events.write"),
  v.literal("articles.read"),
  v.literal("articles.write"),
  v.literal("collections.read"),
  v.literal("collections.write"),
  v.literal("outbound.read"),
  v.literal("outbound.write"),
  v.literal("webhooks.manage"),
  v.literal("claims.manage")
);

export function isValidScope(scope: string): scope is AutomationScope {
  return (AUTOMATION_SCOPES as readonly string[]).includes(scope);
}

export function validateScopes(scopes: string[]): AutomationScope[] {
  const invalid = scopes.filter((s) => !isValidScope(s));
  if (invalid.length > 0) {
    throw new Error(`Invalid automation scopes: ${invalid.join(", ")}`);
  }
  return scopes as AutomationScope[];
}
