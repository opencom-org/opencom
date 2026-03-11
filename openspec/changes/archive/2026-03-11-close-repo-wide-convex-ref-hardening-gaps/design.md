## Context

The pilot change `stabilize-convex-function-ref-boundaries` proved the hardening pattern in selected Convex, web, and widget slices. A full-repo scan then found three different states across the remaining surfaces:

- residual backend Convex modules that still use broad dynamic ref helpers
- package-specific frontend/SDK areas that still need migration and are already covered by older active changes
- tactical predecessor work, especially `fix-sdk-core-convex-type-surface`, where implementation largely exists but verification/closure is incomplete

The problem is no longer "invent the pattern." It is "close the remaining gaps without duplicating ownership or creating migration batches large enough to re-trigger broad type explosions."

## Goals / Non-Goals

**Goals:**

- Assign every known remaining gap to a single owning change or explicit exception.
- Keep older web/widget/react-native package proposals in place where they still match the current source shape.
- Verify whether older tactical changes are actually implemented in code even if their tasks are not marked complete.
- Use this change to own residual backend Convex cleanup not already covered elsewhere, plus shared guardrails and verification closure.
- Sequence work in micro-batches small enough to rerun package verification before broadening scope.

**Non-Goals:**

- Collapsing all active hardening changes into one mega-change.
- Rewriting the established wrapper-hook architecture changes for web, widget, or React Native SDK.
- Treating unchecked OpenSpec tasks as proof that implementation is missing.
- Forcing sdk-core follow-on hardening into its older tactical proposal if that proposal's implemented scope is already satisfied.

## Decisions

### 1) Do not combine the older package-specific proposals into one mega-change

Decision:

- Keep `introduce-web-local-convex-wrapper-hooks`, `introduce-widget-local-convex-wrapper-hooks`, and `refactor-react-native-sdk-hook-boundaries` as the owning changes for their respective package migrations.
- This change coordinates, verifies, and fills residual gaps rather than absorbing those changes wholesale.

Rationale:

- The existing proposals encode package-specific target architectures that still match the codebase.
- Combining them now would blur responsibility, lose progress fidelity, and increase migration batch size unnecessarily.

Alternatives considered:

- Merge all active hardening proposals into this change. Rejected because the resulting scope would be too large to validate safely and would duplicate active architecture work already specified elsewhere.

### 2) Treat `fix-sdk-core-convex-type-surface` as a tactical predecessor, not the final ideal state

Decision:

- Verify the implemented sdk-core code against `fix-sdk-core-convex-type-surface`.
- If the code satisfies that narrower stability scope, finish its remaining verification tasks and archive it.
- If additional sdk-core cleanup is still desired beyond that scope, track it as a separate follow-on delta or under explicit residual inventory here, rather than pretending the old proposal still owns the stronger end state.
- Treat the current localized `makeFunctionReference(name)` helper pattern in `packages/sdk-core/src/api/**` as an accepted predecessor outcome, not as residual work for this coordinating change, unless a separate explicit sdk-core follow-on delta is opened.
- Prefer generated `api.*` / `internal.*` refs by default; use `makeFunctionReference("module:function")` only when a verified hotspot still triggers `TS2589` after shallower local boundaries are considered.
- If a future sdk-core follow-on is opened, prefer explicit per-function constants over broad `getMutationRef(name: string)` / `getQueryRef(name: string)` factories.

Rationale:

- Current sdk-core code largely matches the old proposal's localized type-stability workaround, even though verification tasks remain unchecked.
- The stronger "no generic string ref factory" end state is a different goal from the old proposal's tactical stability objective.

Alternatives considered:

- Keep sdk-core fully inside this new cross-surface change. Rejected because it mixes predecessor verification with new implementation work.

### 3) Freeze the remaining owner map as of March 10, 2026

Decision:

- Freeze the current remaining-gap inventory so active owner changes can be updated against a stable file list.
- Treat shared test-helper cleanup separately from package runtime/UI migrations when the issue is helper duplication rather than boundary architecture.

Frozen owner map:

- Accepted predecessor outcome under `fix-sdk-core-convex-type-surface`:
  - `packages/sdk-core/src/api/aiAgent.ts`
  - `packages/sdk-core/src/api/articles.ts`
  - `packages/sdk-core/src/api/carousels.ts`
  - `packages/sdk-core/src/api/checklists.ts`
  - `packages/sdk-core/src/api/commonIssues.ts`
  - `packages/sdk-core/src/api/conversations.ts`
  - `packages/sdk-core/src/api/events.ts`
  - `packages/sdk-core/src/api/officeHours.ts`
  - `packages/sdk-core/src/api/outbound.ts`
  - `packages/sdk-core/src/api/sessions.ts`
  - `packages/sdk-core/src/api/tickets.ts`
  - `packages/sdk-core/src/api/visitors.ts`
- `introduce-web-local-convex-wrapper-hooks` owns the current web hotspot cluster:
  - `apps/web/src/app/articles/[id]/page.tsx`
  - `apps/web/src/app/articles/collections/page.tsx`
  - `apps/web/src/app/articles/page.tsx`
  - `apps/web/src/app/campaigns/carousels/[id]/page.tsx`
  - `apps/web/src/app/campaigns/page.tsx`
  - `apps/web/src/app/campaigns/push/[id]/page.tsx`
  - `apps/web/src/app/campaigns/series/[id]/page.tsx`
  - `apps/web/src/app/checklists/[id]/page.tsx`
  - `apps/web/src/app/checklists/page.tsx`
  - `apps/web/src/app/inbox/page.tsx`
  - `apps/web/src/app/outbound/[id]/page.tsx`
  - `apps/web/src/app/settings/MessengerSettingsSection.tsx`
  - `apps/web/src/app/settings/page.tsx`
  - `apps/web/src/app/tooltips/page.tsx`
- `introduce-widget-local-convex-wrapper-hooks` owns the current widget hotspot cluster:
  - `apps/widget/src/components/ConversationView.tsx`
  - `apps/widget/src/tourOverlay/useTourOverlayActions.ts`
- `refactor-react-native-sdk-hook-boundaries` owns the current React Native SDK hotspot cluster:
  - `packages/react-native-sdk/src/components/OpencomCarousel.tsx`
  - `packages/react-native-sdk/src/components/OpencomHome.tsx`
  - `packages/react-native-sdk/src/components/OpencomTicketCreate.tsx`
  - `packages/react-native-sdk/src/components/messenger/useConversationDetailController.ts`
  - `packages/react-native-sdk/src/components/survey/useSurveyController.ts`
  - `packages/react-native-sdk/src/hooks/useAIAgent.ts`
  - `packages/react-native-sdk/src/hooks/useArticleSuggestions.ts`
  - `packages/react-native-sdk/src/hooks/useArticles.ts`
  - `packages/react-native-sdk/src/hooks/useAutomationSettings.ts`
  - `packages/react-native-sdk/src/hooks/useChecklists.ts`
  - `packages/react-native-sdk/src/hooks/useConversations.ts`
  - `packages/react-native-sdk/src/hooks/useMessengerSettings.ts`
  - `packages/react-native-sdk/src/hooks/useOfficeHours.ts`
  - `packages/react-native-sdk/src/hooks/useOutboundMessages.ts`
  - `packages/react-native-sdk/src/hooks/useSurveyDelivery.ts`
  - `packages/react-native-sdk/src/hooks/useTickets.ts`
  - `packages/react-native-sdk/src/push/index.ts`
- `close-repo-wide-convex-ref-hardening-gaps` directly owns the current residual backend and shared guardrail cluster:
  - `packages/convex/convex/aiAgent.ts`
  - `packages/convex/convex/articles.ts`
  - `packages/convex/convex/conversations.ts`
  - `packages/convex/convex/emailChannel.ts`
  - `packages/convex/convex/embeddings.ts`
  - `packages/convex/convex/events.ts`
  - `packages/convex/convex/http.ts`
  - `packages/convex/convex/internalArticles.ts`
  - `packages/convex/convex/messages.ts`
  - `packages/convex/convex/notifications/dispatch.ts`
  - `packages/convex/convex/notifications/emitters/chat.ts`
  - `packages/convex/convex/notifications/emitters/ticket.ts`
  - `packages/convex/convex/notifications/routing.ts`
  - `packages/convex/convex/push.ts`
  - `packages/convex/convex/pushCampaigns.ts`
  - `packages/convex/convex/series/scheduler.ts`
  - `packages/convex/convex/snippets.ts`
  - `packages/convex/convex/testing/helpers/notifications.ts`
  - `packages/convex/convex/tickets.ts`
  - `packages/convex/convex/visitors/mutations.ts`
  - `packages/convex/convex/workspaceMembers.ts`
  - `apps/web/src/app/articles/[id]/page.test.tsx`
  - `apps/web/src/app/settings/MessengerSettingsSection.test.tsx`
  - `apps/web/src/app/typeHardeningGuard.test.ts`
  - `apps/widget/src/test/convexFunctionRefs.ts`
  - `apps/widget/src/test/widgetShellOrchestration.test.tsx`
  - `apps/widget/src/test/widgetTicketErrorFeedback.test.tsx`
  - `apps/widget/src/test/widgetTourBridgeLifecycle.test.tsx`
  - `apps/widget/src/test/widgetTourStart.test.tsx`
  - `packages/convex/tests/runtimeTypeHardeningGuard.test.ts`
- Accepted dynamic exception documented and guarded by `close-repo-wide-convex-ref-hardening-gaps`:
  - `packages/convex/convex/testAdmin.ts`
    - This file may continue to use caller-selected `makeFunctionReference(name)` dispatch because it is the secret-protected test admin gateway.
    - The exception remains valid only while dispatch stays limited to the `testData` and `testing` module prefixes and guard tests pin that scope.

Rationale:

- This is the smallest owner map that matches the live scan without reopening the verified sdk-core predecessor work.
- Widget and web test helper duplication is a shared guardrail concern, not a reason to broaden the package runtime-owner changes.

### 4) Residual implementation work is owned by file-cluster micro-batches, not package-wide batches

Decision:

- Break remaining implementation into small file clusters within each owning package or change.
- Require package typecheck and focused tests after each cluster.

Rationale:

- The user goal is explicit: validate types before going deep and avoid large type-error cascades.
- Package-wide migration batches are still too coarse for that goal.

Alternatives considered:

- Package-batch migration. Rejected because even a single package such as `apps/web` or `packages/react-native-sdk` still contains too many unrelated hotspots to change safely in one pass.

### 5) This change owns residual backend cleanup plus cross-change guardrails

Decision:

- Keep this change focused on:
  - freezing the repo-wide inventory
  - mapping each gap to the correct owner
  - residual `packages/convex` cleanup not already claimed elsewhere
  - shared guardrails and verification rules across the related changes

Rationale:

- That is the missing coordination layer the repo does not currently have.
- It avoids leaving residual backend-only gaps orphaned while respecting the package-specific architecture changes.

Alternatives considered:

- Use this change only as documentation. Rejected because residual backend and guardrail work still needs an implementation owner.

## Risks / Trade-offs

- [Risk] Ownership mapping may reveal that some older proposals need scope adjustments.
  - Mitigation: update those proposal task lists explicitly rather than silently re-owning their work here.
- [Risk] sdk-core may sit awkwardly between "implemented tactical workaround" and "not yet ideal boundary shape."
  - Mitigation: separate predecessor verification from any follow-on hardening objective.
- [Risk] Guardrails can become vague if inventory is not exact.
  - Mitigation: freeze the file list before adding broad checks.
- [Risk] The accepted `testAdmin.ts` exception could expand into a general runtime escape hatch.
  - Mitigation: document it as the only residual dynamic exception and keep explicit guard assertions on its allowed module prefixes.
- [Risk] Multiple active changes increase administrative overhead.
  - Mitigation: use this change to drive validation and closure order instead of merging everything.

## Migration Plan

1. Freeze the remaining-gap inventory and map each file cluster to one owner change or explicit exception.
2. Verify actual implementation state of overlapping older changes against current code, starting with `fix-sdk-core-convex-type-surface`.
3. Finish verification and archive predecessor changes whose implemented scope is already satisfied.
4. Update older owning changes where current code still clearly matches their unfinished scope (`apps/web`, `apps/widget`, `packages/react-native-sdk`).
5. Implement residual backend Convex cleanup and cross-change guardrails in micro-batches with package verification after each batch.
6. Run strict OpenSpec validation for this change and any touched dependent changes.

Rollback:

- Revert only the current micro-batch or task-sync change; do not collapse or rewrite the other active proposals during rollback.

## Open Questions

- Which exact residual sdk-core gaps are true follow-on hardening work versus acceptable under the archived tactical stability scope?
- Should the final inventory live only in this change, or also be copied into the dependent owning changes for clarity?
- Do we want a separate small follow-on for sdk-core final-state cleanup if the stronger end state is still required after predecessor verification?
