import { mobileMutationRef, useMobileMutation } from "../../lib/convex/hooks";

type RegisterPushTokenArgs = {
  token: string;
  userId: string;
  platform: "ios" | "android";
};

type PushDebugLogArgs = {
  stage: string;
  details?: string;
};

const REGISTER_PUSH_TOKEN_MUTATION_REF = mobileMutationRef<RegisterPushTokenArgs, null>(
  "pushTokens:register"
);
const PUSH_DEBUG_LOG_MUTATION_REF = mobileMutationRef<PushDebugLogArgs, null>(
  "pushTokens:debugLog"
);

export function useNotificationRegistrationConvex() {
  return {
    debugLog: useMobileMutation(PUSH_DEBUG_LOG_MUTATION_REF),
    registerPushToken: useMobileMutation(REGISTER_PUSH_TOKEN_MUTATION_REF),
  };
}
