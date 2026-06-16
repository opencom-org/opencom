import { cronJobs, makeFunctionReference } from "convex/server";

const crons = cronJobs();

const expireStaleClaimsRef = makeFunctionReference<"mutation">(
  "automationConversationClaims:expireStaleClaims"
);
const cleanupExpiredKeysRef = makeFunctionReference<"mutation">(
  "lib/idempotency:cleanupExpiredIdempotencyKeys"
);

// Expire stale automation conversation claims every 5 minutes
crons.interval(
  "expire stale automation claims",
  { minutes: 5 },
  expireStaleClaimsRef as any,
  {}
);

// Clean up expired idempotency keys every hour
crons.interval(
  "cleanup expired idempotency keys",
  { hours: 1 },
  cleanupExpiredKeysRef as any,
  {}
);

export default crons;
