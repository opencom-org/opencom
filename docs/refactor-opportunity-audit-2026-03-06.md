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
- Public messenger settings and default home config are now centralized in `@opencom/types`.
- `packages/convex/convex/messengerSettings.ts` is down to `129` lines from `792`.
- Tour route matching is now centralized in `@opencom/types`.
- `apps/widget/src/TourOverlay.tsx` is down to `253` lines from `996`.
- `packages/convex/convex/tourProgress.ts` is down to `120` lines from `834`.
- `packages/convex/convex/series/runtime.ts` is down to `210` lines from `1078`.
- `packages/convex/convex/series/authoring.ts` is down to `482` lines from `784`.
- The biggest remaining opportunities are no longer generic "large page" cleanups.
- The highest-value remaining work is concentrated in a small set of runtime controllers and cross-surface domain contracts.

## Top Refactor Opportunities

| Rank | Opportunity | Why it is still high-value | Primary evidence |
|---|---|---|---|
| 1 | Workspace admin/security/onboarding split across backend, web, and mobile | The March 7 phase-1 pass extracted hosted onboarding out of [`workspaces.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/workspaces.ts) and reduced the web shell in [`SecuritySettingsSection.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/web/src/app/settings/SecuritySettingsSection.tsx), but the track is still high-value because [`apps/mobile/app/(app)/settings.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/mobile/app/(app)/settings.tsx) remains `1048` lines and `workspaces.ts` still mixes public context, origin validation, signup policy, and help-center policy. This is now a clearer phase-2 target rather than a greenfield backlog item. | `docs/refactor-progress-workspace-admin-security-onboarding-v1-2026-03-07.md`, `packages/convex/convex/workspaces.ts`, `apps/mobile/app/(app)/settings.tsx` |
| 2 | Widget shell orchestration phase 2 | A phase-2 pass has now extracted conversation, article, and ticket state machines into [`useWidgetConversationFlow.ts`](/Users/jack/dev/Repos/opencom-prod/apps/widget/src/hooks/useWidgetConversationFlow.ts), [`useWidgetArticleNavigation.ts`](/Users/jack/dev/Repos/opencom-prod/apps/widget/src/hooks/useWidgetArticleNavigation.ts), and [`useWidgetTicketFlow.ts`](/Users/jack/dev/Repos/opencom-prod/apps/widget/src/hooks/useWidgetTicketFlow.ts). [`Widget.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/widget/src/Widget.tsx) is down to `966` lines from `1285`, so this track is healthier than it was, but still worth another pass if we want the shell controller to stop being a notable hotspot. | `apps/widget/src/Widget.tsx`, `apps/widget/src/hooks/useWidgetConversationFlow.ts`, `apps/widget/src/hooks/useWidgetArticleNavigation.ts`, `apps/widget/src/hooks/useWidgetTicketFlow.ts`, `docs/refactor-progress-widget-shell-orchestration-v2-2026-03-06.md` |
| 3 | Cross-surface outbound runtime convergence | [`OutboundOverlay.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/widget/src/OutboundOverlay.tsx) and [`OpencomOutbound.tsx`](/Users/jack/dev/Repos/opencom-prod/packages/react-native-sdk/src/components/OpencomOutbound.tsx) still implement similar message-visibility, staggering, dismissal, and click-action behavior separately. The dormant [`TriggerConfigEditor.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/web/src/components/TriggerConfigEditor.tsx) also still carries a local trigger contract shape that has drift risk if it becomes live again. This is a good DRY opportunity after the authoring-contract work already completed. | `apps/widget/src/OutboundOverlay.tsx`, `packages/react-native-sdk/src/components/OpencomOutbound.tsx`, `apps/web/src/components/TriggerConfigEditor.tsx`, `packages/sdk-core/src/api/outbound.ts` |
| 4 | Knowledge/content admin split plus article-domain split | [`knowledge/page.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/web/src/app/knowledge/page.tsx) still combines folder tree state, drag/drop, search, filters, and three content-type surfaces. On the backend, [`articles.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/articles.ts) still combines authoring, assets, publishing, feedback, visitor delivery, and audience preview logic. The admin surface and the backend domain are both still too dense. | `apps/web/src/app/knowledge/page.tsx`, `packages/convex/convex/articles.ts` |
| 5 | Campaigns admin decomposition | [`campaigns/page.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/web/src/app/campaigns/page.tsx) is still `732` lines and owns four product domains at once with `15` mutations. The file is large for a real reason: email, push, carousel, and series list behaviors are multiplexed behind one route-local controller. This is still a meaningful maintainability win, even if it is below the runtime and contract-convergence work above. | `apps/web/src/app/campaigns/page.tsx` |
| 6 | AI agent domain split | [`aiAgent.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/aiAgent.ts) and [`aiAgentActions.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/aiAgentActions.ts) still combine settings, diagnostics, runtime access, knowledge retrieval, feedback, handoff, analytics, provider configuration validation, and response generation. This is a high-churn area where smaller modules would materially reduce debugging cost. | `packages/convex/convex/aiAgent.ts`, `packages/convex/convex/aiAgentActions.ts` |
| 7 | Email channel split | [`emailChannel.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/emailChannel.ts) still mixes provider config, inbound parsing, thread matching, visitor creation, delivery status handling, and provider send orchestration. This is a classic backend multi-responsibility file with operational risk. | `packages/convex/convex/emailChannel.ts` |
| 8 | Audience-rule builder internals | [`AudienceRuleBuilder.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/web/src/components/AudienceRuleBuilder.tsx) still mixes recursive rule-tree editing, operator metadata, event/source adaptation, and UI rendering. It is not the highest blast-radius item left, but it is still one of the highest-leverage frontend maintainability cleanups because it sits on top of shared audience contracts. | `apps/web/src/components/AudienceRuleBuilder.tsx` |
| 9 | Convex series backend follow-up | The March 7 phase-2 pass split series runtime and authoring into focused modules: [`runtime.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/series/runtime.ts), [`authoring.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/series/authoring.ts), [`runtimeProcessing.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/series/runtimeProcessing.ts), [`runtimeExecution.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/series/runtimeExecution.ts), [`runtimeEnrollment.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/series/runtimeEnrollment.ts), and [`readiness.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/series/readiness.ts). This track is much healthier now, but there is still optional follow-up if `runtimeProcessing.ts` or `runtimeExecution.ts` become hotspots under future feature work. | `docs/refactor-progress-convex-series-runtime-authoring-v2-2026-03-07.md`, `packages/convex/convex/series/runtimeProcessing.ts`, `packages/convex/convex/series/runtimeExecution.ts` |
| 10 | Tour runtime isolated follow-up | The March 7 backend split reduced [`tourProgress.ts`](/Users/jack/dev/Repos/opencom-prod/packages/convex/convex/tourProgress.ts) to a `120`-line endpoint shell backed by focused helper modules. The remaining tour-runtime work is now optional and isolated: mainly [`useTourOverlayPositioning.ts`](/Users/jack/dev/Repos/opencom-prod/apps/widget/src/tourOverlay/useTourOverlayPositioning.ts), and only secondarily the extracted Convex mutation/query modules if they start growing again. | `docs/refactor-progress-convex-tour-progress-decomposition-2026-03-07.md`, `apps/widget/src/tourOverlay/useTourOverlayPositioning.ts` |

## Recommended Execution Order

If the goal is to keep making the codebase easier to reason about while avoiding another broad backlog, the best next queue is:

1. Workspace admin/security/onboarding split
2. Either finish widget shell orchestration phase 2 or move to cross-surface outbound runtime convergence
3. Split knowledge/admin content plus the remaining article-domain concentration
4. Decompose the campaigns admin surface, then reassess before continuing deeper into service domains

After those, re-run the hotspot scan before committing to the rest of the list.

Update after the March 7 tour-runtime pass:

- Route matching is no longer the active sub-problem in this track.
- `TourOverlay.tsx` is no longer a top-tier concentration file.
- `tourProgress.ts` is now down to `120` lines from `834`.
- The remaining tour-runtime work is now:
  - optional pure-helper trimming inside `useTourOverlayPositioning.ts` if that isolated hook becomes hard to maintain
  - optional follow-up inside the extracted Convex helper modules only if one of them becomes the next obvious hotspot

Update after the March 7 series phase-2 pass:

- `series/runtime.ts` and `series/authoring.ts` are no longer top-tier concentration files.
- The remaining series work is now optional follow-up inside isolated backend modules rather than one oversized domain controller.

Update after the March 7 messenger/home contract pass:

- Public messenger settings are now centralized in `@opencom/types`.
- Widget and RN no longer maintain separate home-config contract definitions for this surface.
- The remaining messenger/home work is now backend/web decomposition rather than public contract convergence.

Update after the March 7 messenger backend decomposition pass:

- `messengerSettings.ts` is no longer a top-tier concentration file.
- The remaining messenger/home work is now centered mainly on `MessengerSettingsSection.tsx`, not the Convex endpoint shell.

Update after the March 7 messenger web authoring pass:

- `MessengerSettingsSection.tsx` is down to `179` lines from `570`.
- The messenger settings authoring surface now delegates to `messengerSettingsForm.ts`, `MessengerSettingsFormFields.tsx`, and `MessengerSettingsPreview.tsx`.
- The remaining messenger/home work is no longer a top-tier cross-surface contract problem.
- If this track continues, the likely follow-up is `HomeSettingsSection.tsx` (`463` lines), not another messenger settings controller pass.

Update after the March 7 workspace admin/security/onboarding phase-1 pass:

- `workspaces.ts` is down to `370` lines from `756`.
- Hosted onboarding now lives behind isolated workspace helper modules instead of being embedded inline in `workspaces.ts`.
- `SecuritySettingsSection.tsx` is down to `124` lines from `709`.
- The remaining work in this track is now mainly:
  - `apps/mobile/app/(app)/settings.tsx`
  - optional backend extraction of the remaining workspace policy/public-context handlers

## Lower-Cost Cleanup Items

These are not the highest-value next slices, but they are still worth doing when adjacent work touches them:

- Delete or align the unused [`TriggerConfigEditor.tsx`](/Users/jack/dev/Repos/opencom-prod/apps/web/src/components/TriggerConfigEditor.tsx) to the shared trigger contract.
- Keep converging pure matching/delivery helpers into shared modules instead of letting widget, RN, and Convex keep their own copies.

## Superseded Docs

These older backlog docs are still useful as history, but they should not be treated as the current ranking anymore:

- [`refactor-remaining-map-2026-03-05.md`](/Users/jack/dev/Repos/opencom-prod/docs/refactor-remaining-map-2026-03-05.md)
- [`refactor-remaining-slices-pass2-2026-03-05.md`](/Users/jack/dev/Repos/opencom-prod/docs/refactor-remaining-slices-pass2-2026-03-05.md)
