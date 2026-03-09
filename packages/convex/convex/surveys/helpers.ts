import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUserFromSession } from "../auth";
import { hasPermission, requirePermission } from "../permissions";

export async function requireSurveyManagePermission(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
) {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  await requirePermission(ctx, user._id, workspaceId, "settings.workspace");
  return user;
}

export async function canManageSurveys(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<boolean> {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    return false;
  }
  return await hasPermission(ctx, user._id, workspaceId, "settings.workspace");
}

export async function storeAnswersAsAttributes(
  ctx: MutationCtx,
  survey: { questions: Array<{ id: string; storeAsAttribute?: string }> },
  answers: Array<{ questionId: string; value: unknown }>,
  visitorId: Id<"visitors">
): Promise<void> {
  const visitor = (await ctx.db.get(visitorId)) as Doc<"visitors"> | null;
  if (!visitor) {
    return;
  }

  type AttributeValue =
    | string
    | number
    | boolean
    | (string | number | boolean | null)[]
    | Record<string, string | number | boolean | null>
    | null;

  const customAttributes = { ...(visitor.customAttributes || {}) } as Record<
    string,
    AttributeValue
  >;
  let hasUpdates = false;

  for (const answer of answers) {
    const question = survey.questions.find((q) => q.id === answer.questionId);
    if (question?.storeAsAttribute) {
      const value = answer.value as AttributeValue;
      customAttributes[question.storeAsAttribute] = value;
      hasUpdates = true;
    }
  }

  if (hasUpdates) {
    await ctx.db.patch(visitorId, { customAttributes });
  }
}

export function serializeAnswerValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function escapeCsvCell(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}
