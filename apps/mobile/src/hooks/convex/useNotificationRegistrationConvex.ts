import type { Id } from "@opencom/convex/dataModel";
import { makeFunctionReference } from "convex/server";
import { useMobileMutation } from "../../lib/convex/hooks";

type RegisterPushTokenArgs = {
  token: string;
  userId: Id<"users">;
  platform: "ios" | "android";
};

type PushDebugLogArgs = {
  stage: string;
  details?: string;
};

type PushDebugLogResult = {
  success: true;
  authUserId: Id<"users"> | null;
};

const REGISTER_PUSH_TOKEN_MUTATION_REF = makeFunctionReference<
  "mutation",
  RegisterPushTokenArgs,
  Id<"pushTokens">
>("pushTokens:register");
const PUSH_DEBUG_LOG_MUTATION_REF = makeFunctionReference<
  "mutation",
  PushDebugLogArgs,
  PushDebugLogResult
>("pushTokens:debugLog");

export function useNotificationRegistrationConvex() {
  return {
    debugLog: useMobileMutation(PUSH_DEBUG_LOG_MUTATION_REF),
    registerPushToken: useMobileMutation(REGISTER_PUSH_TOKEN_MUTATION_REF),
  };
}
