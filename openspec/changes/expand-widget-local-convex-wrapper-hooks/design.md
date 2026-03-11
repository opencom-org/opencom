## Context

The archived `introduce-widget-local-convex-wrapper-hooks` change covered the initial widget hotspot cluster, but the March 11, 2026 scan still found direct `convex/react` imports in the following remaining widget modules:

- runtime and overlay modules
  - `apps/widget/src/AuthoringOverlay.tsx`
  - `apps/widget/src/ChecklistOverlay.tsx`
  - `apps/widget/src/CsatPrompt.tsx`
  - `apps/widget/src/OutboundOverlay.tsx`
  - `apps/widget/src/SurveyOverlay.tsx`
  - `apps/widget/src/TooltipAuthoringOverlay.tsx`
  - `apps/widget/src/Widget.tsx`
  - `apps/widget/src/components/Home.tsx`
  - `apps/widget/src/tourOverlay/useTourOverlaySession.ts`
- session, tracking, and orchestration hooks
  - `apps/widget/src/hooks/useEventTracking.ts`
  - `apps/widget/src/hooks/useNavigationTracking.ts`
  - `apps/widget/src/hooks/useWidgetConversationFlow.ts`
  - `apps/widget/src/hooks/useWidgetSession.ts`
  - `apps/widget/src/hooks/useWidgetSettings.ts`
  - `apps/widget/src/hooks/useWidgetShellValidation.ts`
  - `apps/widget/src/hooks/useWidgetTicketFlow.ts`

The scan also found direct imports in explicit infrastructure or test boundaries:

- `apps/widget/src/lib/convex/hooks.ts`
- `apps/widget/src/main.tsx`
- `apps/widget/src/components/ConversationView.test.tsx`
- `apps/widget/src/test/outboundOverlay.test.tsx`
- `apps/widget/src/test/refHardeningGuard.test.ts`
- `apps/widget/src/test/tourOverlay.test.tsx`
- `apps/widget/src/test/useWidgetSession.test.tsx`
- `apps/widget/src/test/widgetNewConversation.test.tsx`
- `apps/widget/src/test/widgetShellOrchestration.test.tsx`
- `apps/widget/src/test/widgetTicketErrorFeedback.test.tsx`
- `apps/widget/src/test/widgetTourBridgeLifecycle.test.tsx`
- `apps/widget/src/test/widgetTourStart.test.tsx`

Those infrastructure and test files are acceptable boundaries as long as runtime/widget feature logic no longer depends on direct hook imports.

## Goals / Non-Goals

**Goals:**

- Expand widget-local wrapper coverage to the remaining runtime, shell, session, overlay, and tracking modules.
- Keep direct `convex/react` imports limited to explicit adapter, bootstrap, or targeted test boundaries after the migration.
- Preserve current widget boot, session, overlay, and visitor-visible behavior.
- Extend widget hardening guard coverage so the March 11, 2026 inventory stays explicit.

**Non-Goals:**

- Rewriting the low-level adapter or bootstrap modules that already own provider wiring.
- Changing widget backend contracts, public embed behavior, or visitor-visible UX beyond wrapper extraction.
- Eliminating direct hook mocking from every widget test if those tests intentionally exercise the adapter boundary.

## Decisions

### 1) Migrate shell and session modules before secondary overlays

Decision:

- Start with `Widget.tsx`, `Home.tsx`, session hooks, tracking hooks, and shell validation, then move through overlays and tour session helpers.

Rationale:

- The shell and session modules are the highest-leverage boundary because other overlays and flows compose them.

Alternatives considered:

- Start with overlay files only. Rejected because the shell/session hooks would still expose direct transport concerns to the rest of the runtime.

### 2) Keep approved direct-import exceptions explicit

Decision:

- Treat `lib/convex/hooks.ts`, `main.tsx`, and targeted widget test files as the only accepted direct `convex/react` boundaries during this change unless another explicit infrastructure exception is added deliberately.

Rationale:

- The remaining issue is runtime and orchestration ownership, not provider bootstrap or test harness code.

### 3) Use feature-local wrappers where whole-domain wrappers are too broad

Decision:

- When a widget area only needs a few tightly related Convex calls, allow a feature-local typed ref helper or wrapper hook rather than forcing a single mega-wrapper module.

Rationale:

- The widget runtime is smaller and more orchestration-heavy than web admin. Feature-local helpers can stay clearer than an oversized shared wrapper package.

### 4) Expand widget hardening guards with the new coverage

Decision:

- Update widget guard tests so the remaining runtime inventory becomes explicit and regressions are visible once the migration lands.

Rationale:

- This keeps the change from becoming another one-off cleanup without anti-regression protection.

## Risks / Trade-offs

- [Risk] Session and widget shell extraction could change initialization timing.
  - Mitigation: migrate shell/session modules first and run focused widget runtime tests after each batch.
- [Risk] Overlay modules might end up depending on too many wrapper layers.
  - Mitigation: use feature-local wrappers or typed ref helpers where a shared wrapper would be broader than the feature actually needs.
- [Risk] Test boundaries could become confused with runtime boundaries.
  - Mitigation: keep the accepted test exception list explicit and separate from runtime/UI migration targets.

## Migration Plan

1. Freeze the March 11, 2026 widget inventory and record the allowed direct-import exceptions.
2. Expand wrapper coverage for widget shell, home, session lifecycle, tracking, and shell validation modules.
3. Migrate outbound, checklist, survey, CSAT, authoring, tooltip, and tour-session modules.
4. Update widget hardening guards and any touched runtime tests.
5. Run `pnpm --filter @opencom/widget typecheck`, targeted widget tests, and strict OpenSpec validation.

Rollback:

- Revert only the current widget domain batch if wrapper extraction changes runtime behavior. Do not broaden the accepted direct-import exception list just to mask a failing batch.

## Open Questions

- Should `useWidgetConversationFlow.ts` and `useWidgetTicketFlow.ts` share a common session-aware wrapper layer once `useWidgetSession.ts` is hardened, or stay as separate feature wrappers?
