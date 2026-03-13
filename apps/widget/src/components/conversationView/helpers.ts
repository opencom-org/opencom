import { DEFAULT_HUMAN_AGENT_NAME } from "./constants";

export function resolveHumanAgentName(senderName?: string): string {
  const normalized = senderName?.trim();
  return normalized && normalized.length > 0 ? normalized : DEFAULT_HUMAN_AGENT_NAME;
}
