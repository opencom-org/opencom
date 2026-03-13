## 1. Scope Locks And Inventory

- [x] 1.1 Keep the change scoped to unfinished backend hardening work and preserve the existing out-of-scope decisions for sdk-core `getRelevantKnowledge` action routing, embedding concurrency, and the accepted `testAdmin.ts` dynamic exception.
- [x] 1.2 Update the active hardening inventory so the remaining covered file clusters and approved exceptions are explicit before code cleanup expands.

## 2. RAG-Critical Backend Boundaries

- [x] 2.1 Replace the remaining generic query-ref helper and narrow the residual runner cast in `packages/convex/convex/aiAgentActionsKnowledge.ts`.
- [x] 2.2 Replace generic ref helpers in `packages/convex/convex/aiAgentActions.ts` and `packages/convex/convex/aiAgent.ts` with fixed named refs or a shared typed ref module, keeping only hotspot-local shallow runners if `TS2589` still requires them.
- [x] 2.3 Replace generic ref helpers in `packages/convex/convex/embeddings.ts` and `packages/convex/convex/embeddings/functionRefs.ts` with fixed named refs while preserving the already-finished batching/backfill concurrency behavior.
- [x] 2.4 Run `pnpm --filter @opencom/convex typecheck` and the focused guard/test coverage needed for the AI retrieval and embedding hardening batch.

## 3. Shared Ref Helper Modules

- [x] 3.1 Replace generic selector helpers in `packages/convex/convex/notifications/functionRefs.ts` with explicit exported refs and keep any shallow runner helpers named and minimal.
- [x] 3.2 Replace generic selector helpers in `packages/convex/convex/push/functionRefs.ts` with explicit exported refs and keep any shallow runner helpers named and minimal.
- [x] 3.3 Remove residual manual cast-only helper patterns in `packages/convex/convex/supportAttachmentFunctionRefs.ts` and align any affected callers with the fixed-ref shape.

## 4. Domain-Specific Runtime Micro-Batches

- [x] 4.1 Harden the messaging and ingestion files `packages/convex/convex/http.ts`, `packages/convex/convex/emailChannel.ts`, `packages/convex/convex/outboundMessages.ts`, and `packages/convex/convex/snippets.ts`.
- [x] 4.2 Harden the workflow and scheduling files `packages/convex/convex/events.ts`, `packages/convex/convex/series/scheduler.ts`, `packages/convex/convex/pushCampaigns.ts`, and `packages/convex/convex/tickets.ts`.
- [x] 4.3 Harden the remaining mutation/helper files `packages/convex/convex/carousels/triggering.ts`, `packages/convex/convex/widgetSessions.ts`, `packages/convex/convex/workspaceMembers.ts`, `packages/convex/convex/visitors/mutations.ts`, and `packages/convex/convex/testing/helpers/notifications.ts`.
- [x] 4.4 Re-run `pnpm --filter @opencom/convex typecheck` and focused tests after each micro-batch before moving to the next cluster.

## 5. Guardrails And Final Verification

- [x] 5.1 Update `packages/convex/tests/runtimeTypeHardeningGuard.test.ts` to match the new fixed-ref inventory and keep accepted exceptions explicit.
- [x] 5.2 Update `packages/sdk-core/tests/refHardeningGuard.test.ts`, `docs/convex-type-safety-playbook.md`, and `AGENTS.md` only if the approved hotspot inventory or exception guidance changes during implementation.
- [x] 5.3 Run `openspec validate harden-convex-function-references --strict --no-interactive` and finish the change by checking off completed tasks.
