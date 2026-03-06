# Refactor Handoff: Web / Widget / Convex (2026-03-06)

## Purpose

This document is the resume point for continuing the maintainability/refactor program across:

- `apps/web`
- `apps/widget`
- `packages/convex`

Reference/compatibility surfaces that must stay stable while continuing:

- `apps/mobile`
- `packages/sdk-core`
- `packages/react-native-sdk`

Use this file in a new chat to recover context without reconstructing the work from commit history or scattered progress notes.

## Current State Snapshot

- Branch: `pr/refactor`
- Working tree is not clean.
- Current uncommitted files at handoff time:
  - `apps/web/src/app/outbound/[id]/editorState.ts`
  - `packages/convex/convex/testData/seeds.ts`
  - `packages/types/src/index.ts`
  - `docs/refactor-progress-centralize-outbound-trigger-contracts-2026-03-06.md`
- Most earlier refactor slices referenced below appear to have been committed already.
- `decompose-web-tour-editor` OpenSpec change exists, all artifacts are done, tasks are complete, and `openspec validate decompose-web-tour-editor --strict --no-interactive` passed.
- There is no live OpenSpec change for the outbound/trigger convergence track. That track is being continued through progress docs and code changes, not through an active change artifact.

## What Has Been Completed

These slices are complete enough that they should be treated as established refactor progress, not fresh discovery work.

| Slice | Status | Evidence |
|---|---|---|
| Audience rule contract alignment | Completed | `docs/refactor-progress-audience-rule-contract-alignment-2026-03-05.md` |
| Shared home config contracts | Completed | `docs/refactor-progress-home-config-shared-contracts-2026-03-05.md` |
| Shared visitor readable ID generator | Completed | `docs/refactor-progress-visitor-readable-id-shared-2026-03-05.md` |
| Cross-surface compatibility gates | Completed | `docs/refactor-progress-cross-surface-compatibility-gates-2026-03-05.md` |
| Convex auth-wrapper adoption | Completed | `docs/refactor-progress-convex-auth-wrapper-adoption-2026-03-05.md` |
| Convex visitors domain decomposition | Completed | `docs/refactor-progress-convex-visitors-decomposition-2026-03-05.md` |
| Convex reporting domain decomposition | Completed | `docs/refactor-progress-convex-reporting-decomposition-2026-03-05.md` |
| Convex campaign delivery domain decomposition | Completed | `docs/refactor-progress-convex-campaign-delivery-decomposition-2026-03-05.md` |
| Convex schema fragmentation pass 1 | Completed | `docs/refactor-progress-convex-schema-fragments-2026-03-05.md` |
| Web settings page domain decomposition | Completed | `docs/refactor-progress-web-settings-domain-decomposition-2026-03-05.md` |
| Web survey editor decomposition | Completed | `docs/refactor-progress-web-survey-editor-decomposition-2026-03-05.md` |
| Web series editor decomposition | Completed | `docs/refactor-progress-web-series-editor-decomposition-2026-03-05.md` |
| Web articles admin decomposition | Completed | `docs/refactor-progress-web-articles-admin-decomposition-2026-03-05.md` |
| Web inbox render-section decomposition | Completed | `docs/refactor-progress-web-inbox-render-sections-2026-03-05.md` |
| Widget shell controller decomposition | Completed | `docs/refactor-progress-widget-shell-controller-decomposition-2026-03-05.md` |
| Widget tour overlay decomposition | Completed | `docs/refactor-progress-widget-tour-overlay-decomposition-2026-03-05.md` |
| Widget conversation view decomposition | Completed | `docs/refactor-progress-widget-conversation-view-decomposition-2026-03-05.md` |
| Widget survey overlay decomposition | Completed | `docs/refactor-progress-widget-survey-overlay-decomposition-2026-03-05.md` |
| Web tour editor decomposition | Completed in code and validated; OpenSpec change not yet archived | `docs/refactor-progress-web-tour-editor-decomposition-2026-03-06.md`, `openspec/changes/decompose-web-tour-editor/` |

## What Is Partially Complete

These tracks have real progress and should not be re-scoped from zero.

### 1. Centralize outbound + trigger contracts

Status:

- In progress
- Significant progress already landed
- No live OpenSpec change currently exists for this track

What is already done:

- Shared Convex outbound validators were extracted:
  - `packages/convex/convex/outboundContracts.ts`
- Convex runtime/schema/seeds now consume shared validators:
  - `packages/convex/convex/outboundMessages.ts`
  - `packages/convex/convex/schema/outboundSupportTables.ts`
  - `packages/convex/convex/testData/seeds.ts`
- Shared outbound message record types were added to `@opencom/types`:
  - `EligibleOutboundMessage`
  - `PersistedOutboundMessage`
- `sdk-core`, `react-native-sdk`, and `widget` outbound consumer types now use shared record contracts:
  - `packages/sdk-core/src/api/outbound.ts`
  - `packages/react-native-sdk/src/hooks/useOutboundMessages.ts`
  - `apps/widget/src/OutboundOverlay.tsx`
- Shared authoring-safe outbound types were added to `@opencom/types`:
  - `AuthoringOutboundButtonAction`
  - `AuthoringOutboundPrimaryButtonAction`
  - `AuthoringMessageButton`
  - `AuthoringOutboundMessageContent`
- Web outbound editor state and Convex seed helpers now use those authoring-safe shared types:
  - `apps/web/src/app/outbound/[id]/editorState.ts`
  - `packages/convex/convex/testData/seeds.ts`

What still appears to remain in this track:

- Decide whether the dormant `apps/web/src/components/TriggerConfigEditor.tsx` trigger shape should be aligned to shared types or left alone until it becomes a live surface again.
- Decide whether `apps/web/src/app/outbound/[id]/editorState.ts` should remain route-local or move into a reusable authoring package/module.

Primary evidence docs:

- `docs/refactor-progress-centralize-outbound-trigger-contracts-2026-03-05.md`
- `docs/refactor-progress-centralize-outbound-trigger-contracts-2026-03-06.md`

### 2. Decompose web outbound editor

Status:

- Started, not complete
- No live OpenSpec change currently exists

What is already done:

- State/business logic extraction started in:
  - `apps/web/src/app/outbound/[id]/editorState.ts`
- Trigger settings and click-action settings panels are now extracted into dedicated route-local modules:
  - `apps/web/src/app/outbound/[id]/OutboundTriggerPanel.tsx`
  - `apps/web/src/app/outbound/[id]/OutboundClickActionPanel.tsx`
- Remaining message-type content editing and preview rendering are now also extracted into dedicated route-local modules:
  - `apps/web/src/app/outbound/[id]/OutboundContentEditor.tsx`
  - `apps/web/src/app/outbound/[id]/OutboundPreviewPanel.tsx`
- Shared outbound list/editor UI metadata is now centralized in:
  - `apps/web/src/app/outbound/outboundMessageUi.tsx`
- `apps/web/src/app/outbound/[id]/page.tsx` already consumes extracted click-action/post-button helpers.

What still appears to remain:

- `apps/web/src/app/outbound/[id]/page.tsx` is now mostly an orchestration shell around data loading, mutations, and section composition.
- Remaining render/controller extraction likely still needed for:
  - potential save/load orchestration hooks if the route is pushed further
- This slice should likely be formalized as a new OpenSpec change if continued seriously.

Primary evidence doc:

- `docs/refactor-progress-web-outbound-editor-decomposition-2026-03-05.md`
- `docs/refactor-progress-web-outbound-editor-decomposition-2026-03-06.md`

### 3. Split convex schema high-concentration tables

Status:

- Started, not complete

What is already done:

- `packages/convex/convex/schema/campaignTables.ts` has been split into focused domain fragments:
  - `campaignEmailTables.ts`
  - `campaignPushTables.ts`
  - `campaignCarouselTables.ts`
  - `campaignSeriesTables.ts`
  - `campaignSurveyTables.ts`
- The old `campaignTables.ts` file now acts as a composition-only aggregator.

What still appears to remain:

- `packages/convex/convex/schema/operationsTables.ts` is still high-concentration.
- `packages/convex/convex/schema/inboxNotificationTables.ts` is still high-concentration.
- A follow-up pass should continue splitting the remaining dense schema fragments if the same maintainability threshold still applies.

Primary evidence doc:

- `docs/refactor-progress-convex-schema-high-concentration-tables-2026-03-06.md`

## Current Best View Of Remaining Work

This is the practical remaining list after accounting for what has already been completed since the older slice maps were written.

### Highest-value remaining tracks

1. Continue `split-convex-schema-high-concentration-tables`
2. Decide whether the dormant trigger-editor drift warrants another `centralize-trigger-and-outbound-contracts` pass
3. Formalize any further `decompose-web-outbound-editor` work only if the orchestration shell still needs to shrink

### Next layer after that

1. Re-audit widget controller concentration after the outbound/trigger track is fully closed.
2. Re-audit Convex high-density runtime domains after schema-table decomposition.
3. Re-audit the web settings security/auth and audience-rule builder concentration only if they still fail the acceptance criteria below.

### Why the older P0/P1 lists are not the current source of truth

`docs/refactor-remaining-slices-pass2-2026-03-05.md` captured a useful backlog, but several items in it were completed afterward.
For deciding what to do next, prefer this document plus:

- `docs/refactor-remaining-map-2026-03-05.md`
- the latest `docs/refactor-progress-*.md` files

## Known Verification State

### Latest focused passes that are green

- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/convex typecheck`
- `pnpm --filter @opencom/convex test`
- `pnpm test:compat:cross-surface`
- `pnpm web:test:e2e -- apps/web/e2e/outbound.spec.ts --project=chromium`
- `pnpm web:test:e2e -- apps/web/e2e/tours.spec.ts --project=chromium`
- `openspec validate decompose-web-tour-editor --strict --no-interactive`

### Last known full-suite baseline

The last explicitly recorded full `pnpm test` run in this refactor thread had:

- Unit: pass
- E2E: fail with 12 deterministic failures

Known failing E2E areas from that baseline:

- `ai-agent-settings`
- `carousels`
- `home-settings` preview
- `inbox` sidecar
- `knowledge` delete flow
- `tooltips` CRUD
- `widget` email capture
- no-auth signup flow

Important:

- The focused passes above are newer than that full-suite baseline.
- The full workspace `pnpm test` was not rerun after every later slice.
- Before declaring the overall refactor complete, rerun the full suite and reclassify any remaining failures.

## Resume Procedure In A New Chat

1. Read this document first.
2. Read the latest progress docs for the two active/partial tracks:
   - `docs/refactor-progress-centralize-outbound-trigger-contracts-2026-03-06.md`
   - `docs/refactor-progress-web-outbound-editor-decomposition-2026-03-06.md`
3. Run `git status --short` immediately and confirm whether the working tree still matches the handoff snapshot in this file.
4. If continuing outbound/trigger convergence, treat the next action as:
   - one more duplication audit pass
   - then either finish the track or formalize the residual work as an OpenSpec change
5. If switching away from outbound work, start `split-convex-schema-high-concentration-tables`.
6. After each slice:
   - run focused verification first
   - run cross-surface compatibility gate when shared contracts or shared types change
   - update or add a `docs/refactor-progress-*.md` note
   - refresh the remaining-map/handoff docs when the next-step recommendation changes materially

## Verification Matrix To Use While Continuing

### When touching shared types or cross-surface contracts

Run:

- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/convex typecheck`
- `pnpm test:compat:cross-surface`

Add focused tests/E2E based on area touched.

### When touching Convex runtime or seeds

Run:

- `pnpm --filter @opencom/convex typecheck`
- `pnpm --filter @opencom/convex test`

### When touching outbound authoring/runtime

Run:

- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/convex typecheck`
- `pnpm test:compat:cross-surface`
- `pnpm web:test:e2e -- apps/web/e2e/outbound.spec.ts --project=chromium`

If widget artifacts are stale first run:

- `bash scripts/build-widget-for-tests.sh`

### When touching tours authoring/runtime

Run:

- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/convex typecheck`
- `pnpm web:test:e2e -- apps/web/e2e/tours.spec.ts --project=chromium`

## Acceptance Criteria

This section defines the difference between:

- "currently identified refactor tasks are complete"
- "the overall refactor is truly complete"

### A. Currently identified refactor tasks are complete when

All of the following are true:

1. The remaining tracks in the "Current Best View Of Remaining Work" section are finished.
2. Each finished slice has:
   - focused verification run
   - a progress doc
   - any associated OpenSpec change validated and archived if applicable
3. `docs/refactor-remaining-map-2026-03-05.md` and this handoff doc no longer identify any immediate next refactor track.
4. A fresh repo pass does not surface any new P0 or obvious P1 slice in the target scope.

### B. The overall refactor is truly complete when

All of A is true, and all of the following are also true:

1. **Architectural concentration is acceptably low**
   - No high-churn file in the target scope still mixes clearly separate business logic, persistence contract adaptation, and large render/runtime branches without a strong reason.
   - Large files are acceptable only when they are primarily orchestration/controller layers with extracted helpers and views.

2. **Contract duplication is intentionally resolved**
   - Stable cross-surface business contracts are centralized in one authoritative place.
   - There are no remaining ad-hoc local redefinitions of the same outbound/tour/survey/shared runtime contract unless they are explicit surface adapters.

3. **Cross-surface safety is preserved**
   - `apps/mobile` typecheck passes.
   - `packages/sdk-core` tests pass.
   - `packages/react-native-sdk` tests pass.
   - Public SDK APIs and Convex endpoint references used by those surfaces remain backward-compatible or are versioned/migrated intentionally.

4. **Primary behavior remains correct**
   - Relevant focused E2E suites for changed user paths pass.
   - Full workspace verification is rerun near the end.
   - Any remaining failures are explicitly triaged as unrelated and accepted, not silently inherited.

5. **Documentation and OpenSpec state are closed**
   - Completed OpenSpec changes are archived.
   - Progress docs exist for meaningful slices.
   - Remaining-map docs are refreshed to show no substantive next track.

6. **A final hotspot audit does not reveal new material work**
   - After the last planned slice, perform one more repo-wide pass over file concentration, duplicated contracts, and cross-surface drift.
   - If that pass reveals another major refactor slice, the overall refactor is not truly complete yet.

## Practical Next Move

If resuming immediately from this exact handoff state, the cleanest next action is:

1. Commit the four currently modified files.
2. If desired, archive `decompose-web-tour-editor`.
3. Start `split-convex-schema-high-concentration-tables`.

If instead the intent is to fully close the outbound/trigger track before switching:

1. Create an OpenSpec change named `centralize-trigger-and-outbound-contracts`.
2. Use the existing 2026-03-05 and 2026-03-06 progress docs as the starting implementation history.
3. Finish the residual duplication audit and decide whether `editorState.ts` remains route-local or becomes shared authoring infrastructure.
