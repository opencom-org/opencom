# Refactor Opportunity Audit (2026-03-06)

## Purpose

This is a fresh repo-wide refactor audit after the recent web/widget/convex decomposition work and the March 6, 2026 web E2E stabilization pass.

It is intended to replace the older "remaining slices" lists as the practical source of truth for what is still worth doing next for robustness, DRYness, maintainability, and reasoning clarity.

## How This Audit Was Done

- Reviewed the current handoff and latest refactor progress docs.
- Ran a code-concentration scan across:
  - `apps/web`
  - `apps/widget`
  - `apps/mobile`
  - `packages/convex`
  - `packages/sdk-core`
  - `packages/react-native-sdk`
- Spot-read the highest-concentration files and the most likely cross-surface drift points.
- Prioritized by:
  - blast radius
  - cross-surface contract drift risk
  - behavioral complexity
  - how much a slice would reduce future debugging cost

## Current Baseline

- Web release bar is green again:
  - `pnpm --filter @opencom/web typecheck`
  - `pnpm web:test:e2e` -> pass (`193` passed, `7` skipped, `0` flaky)
- Tour route matching is now centralized in `@opencom/types`.
- `apps/widget/src/TourOverlay.tsx` is down to `617` lines from `996`.
- The biggest remaining opportunities are no longer generic "large page" cleanups.
- The highest-value remaining work is concentrated in a small set of runtime controllers and cross-surface domain contracts.

## Top Refactor Opportunities

| Rank | Opportunity | Why it is still high-value | Primary evidence |
|---|---|---|---|
| 1 | Tour runtime phase 2 | Shared route matching is now centralized in [`routeMatching.ts`](/Users/jack/dev/Repos/opencom-prod/packages/types/src/routeMatching.ts), and [`TourOverlay.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/widget/src/TourOverlay.tsx) is down to `617` lines after extracting session and action hooks. The remaining hotspot is narrower now: DOM positioning/observer logic still lives in the widget runtime, while [`tourProgress.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/tourProgress.ts) still mixes progression, diagnostics, checkpointing, and availability resolution at `834` lines. This remains the highest cross-surface runtime reasoning slice until those responsibilities split further. | `apps/widget/src/TourOverlay.tsx`, `apps/widget/src/tourOverlay/useTourOverlaySession.ts`, `apps/widget/src/tourOverlay/useTourOverlayActions.ts`, `packages/types/src/routeMatching.ts`, `packages/convex/convex/tourProgress.ts`, `docs/refactor-progress-tour-runtime-shared-route-matching-2026-03-06.md` |
| 2 | Convex series runtime/authoring phase 2 | [`series/runtime.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/series/runtime.ts) (`1078` lines) still mixes trigger matching, graph traversal, status transitions, block execution, scheduling, telemetry, and tag/conversation side effects. [`series/authoring.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/series/authoring.ts) is still large enough that authoring invariants and runtime invariants are difficult to reason about together. | `packages/convex/convex/series/runtime.ts`, `packages/convex/convex/series/authoring.ts` |
| 3 | Widget shell orchestration phase 2 | A phase-2 pass has now extracted conversation, article, and ticket state machines into [`useWidgetConversationFlow.ts`](/Users/jack/dev/Repos/opencom-prod/apps/widget/src/hooks/useWidgetConversationFlow.ts), [`useWidgetArticleNavigation.ts`](/Users/jack/dev/Repos/opencom-prod/apps/widget/src/hooks/useWidgetArticleNavigation.ts), and [`useWidgetTicketFlow.ts`](/Users/jack/dev/Repos/opencom-prod/apps/widget/src/hooks/useWidgetTicketFlow.ts). [`Widget.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/widget/src/Widget.tsx) is down to `966` lines from `1285`, so this track is healthier than it was, but still worth another pass if we want the shell controller to stop being a notable hotspot. | `apps/widget/src/Widget.tsx`, `apps/widget/src/hooks/useWidgetConversationFlow.ts`, `apps/widget/src/hooks/useWidgetArticleNavigation.ts`, `apps/widget/src/hooks/useWidgetTicketFlow.ts`, `docs/refactor-progress-widget-shell-orchestration-v2-2026-03-06.md` |
| 4 | Messenger/home-config contract convergence across Convex, web, widget, and RN | [`messengerSettings.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/messengerSettings.ts) still mixes public widget settings, admin mutation logic, logo asset handling, audience rules, and home-card CRUD. The same concepts are then re-expressed in [`MessengerSettingsSection.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/web/src/app/settings/MessengerSettingsSection.tsx), [`Home.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/widget/src/components/Home.tsx), and [`OpencomHome.tsx`](/Users/jack/dev/Repos/opencom-prod/packages/react-native-sdk/src/components/OpencomHome.tsx). RN still carries local `HomeCard` and `HomeConfig` interfaces and fetches public home config inline rather than relying on a clearly shared view model. | `packages/convex/convex/messengerSettings.ts`, `apps/web/src/app/settings/MessengerSettingsSection.tsx`, `apps/widget/src/components/Home.tsx`, `packages/react-native-sdk/src/components/OpencomHome.tsx` |
| 5 | Workspace admin/security/onboarding split across backend, web, and mobile | [`workspaces.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/workspaces.ts) still bundles public context, onboarding state, origin validation, signup policy, and help-center access policy. The UI side is similarly concentrated in [`SecuritySettingsSection.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/web/src/app/settings/SecuritySettingsSection.tsx) (`709` lines, `9` queries, `7` mutations) and [`apps/mobile/app/(app)/settings.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/mobile/app/(app)/settings.tsx) (`1048` lines). This is a cross-surface admin domain, not three unrelated files. | `packages/convex/convex/workspaces.ts`, `apps/web/src/app/settings/SecuritySettingsSection.tsx`, `apps/mobile/app/(app)/settings.tsx` |
| 6 | Cross-surface outbound runtime convergence | [`OutboundOverlay.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/widget/src/OutboundOverlay.tsx) and [`OpencomOutbound.tsx`](/Users/jack/dev/Repos/opencom-prod/packages/react-native-sdk/src/components/OpencomOutbound.tsx) still implement similar message-visibility, staggering, dismissal, and click-action behavior separately. The dormant [`TriggerConfigEditor.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/web/src/components/TriggerConfigEditor.tsx) also still carries a local trigger contract shape that has drift risk if it becomes live again. This is a good DRY opportunity after the authoring-contract work already completed. | `apps/widget/src/OutboundOverlay.tsx`, `packages/react-native-sdk/src/components/OpencomOutbound.tsx`, `apps/web/src/components/TriggerConfigEditor.tsx`, `packages/sdk-core/src/api/outbound.ts` |
| 7 | Knowledge/content admin split plus article-domain split | [`knowledge/page.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/web/src/app/knowledge/page.tsx) still combines folder tree state, drag/drop, search, filters, and three content-type surfaces. On the backend, [`articles.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/articles.ts) still combines authoring, assets, publishing, feedback, visitor delivery, and audience preview logic. The admin surface and the backend domain are both still too dense. | `apps/web/src/app/knowledge/page.tsx`, `packages/convex/convex/articles.ts` |
| 8 | Campaigns admin decomposition | [`campaigns/page.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/web/src/app/campaigns/page.tsx) is still `732` lines and owns four product domains at once with `15` mutations. The file is large for a real reason: email, push, carousel, and series list behaviors are multiplexed behind one route-local controller. This is still a meaningful maintainability win, even if it is below the runtime and contract-convergence work above. | `apps/web/src/app/campaigns/page.tsx` |
| 9 | AI agent domain split | [`aiAgent.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/aiAgent.ts) and [`aiAgentActions.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/aiAgentActions.ts) still combine settings, diagnostics, runtime access, knowledge retrieval, feedback, handoff, analytics, provider configuration validation, and response generation. This is a high-churn area where smaller modules would materially reduce debugging cost. | `packages/convex/convex/aiAgent.ts`, `packages/convex/convex/aiAgentActions.ts` |
| 10 | Email channel split | [`emailChannel.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/emailChannel.ts) still mixes provider config, inbound parsing, thread matching, visitor creation, delivery status handling, and provider send orchestration. This is a classic backend multi-responsibility file with operational risk. | `packages/convex/convex/emailChannel.ts` |
| 11 | Audience-rule builder internals | [`AudienceRuleBuilder.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/web/src/components/AudienceRuleBuilder.tsx) still mixes recursive rule-tree editing, operator metadata, event/source adaptation, and UI rendering. It is not the highest blast-radius item left, but it is still one of the highest-leverage frontend maintainability cleanups because it sits on top of shared audience contracts. | `apps/web/src/components/AudienceRuleBuilder.tsx` |

## Recommended Execution Order

If the goal is to keep making the codebase easier to reason about while avoiding another broad backlog, the best next queue is:

1. Tour runtime split plus shared route/selector matching
2. Convex series runtime/authoring phase 2
3. Either finish widget shell orchestration phase 2 or stop it intentionally at the current cleaner boundary
4. Messenger/home-config contract convergence
5. Workspace admin/security/onboarding split
6. Cross-surface outbound runtime convergence

After those, re-run the hotspot scan before committing to the rest of the list.

Update after the March 6 tour-runtime pass:

- Route matching is no longer the active sub-problem in this track.
- The remaining tour-runtime work is now:
  - widget overlay positioning/observer extraction
  - Convex progress/diagnostic/query separation

## Lower-Cost Cleanup Items

These are not the highest-value next slices, but they are still worth doing when adjacent work touches them:

- Delete or align the unused [`TriggerConfigEditor.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/web/src/components/TriggerConfigEditor.tsx) to the shared trigger contract.
- Remove duplicated local home-config type definitions in [`OpencomHome.tsx`](/Users/jack/dev/Repos/opencom-prod/packages/react-native-sdk/src/components/OpencomHome.tsx).
- Keep converging pure matching/delivery helpers into shared modules instead of letting widget, RN, and Convex keep their own copies.

## Superseded Docs

These older backlog docs are still useful as history, but they should not be treated as the current ranking anymore:

- [`refactor-remaining-map-2026-03-05.md`](/Users/jack/dev/Repos/opencom-prod/docs/refactor-remaining-map-2026-03-05.md)
- [`refactor-remaining-slices-pass2-2026-03-05.md`](/Users/jack/dev/Repos/opencom-prod/docs/refactor-remaining-slices-pass2-2026-03-05.md)
