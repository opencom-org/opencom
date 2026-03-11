import { formatReadableVisitorId as formatSharedReadableVisitorId } from "@opencom/types";
import type { Id } from "./_generated/dataModel";

export function formatReadableVisitorId(visitorId: Id<"visitors"> | string): string {
  return formatSharedReadableVisitorId(String(visitorId));
}
