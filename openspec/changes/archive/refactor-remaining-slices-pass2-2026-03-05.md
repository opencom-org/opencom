# Remaining Refactor Slices (Pass 2, 2026-03-05)

This is a fresh second-pass slice map for future completion.  
It supersedes the slice prioritization in `docs/refactor-remaining-map-2026-03-05.md`.

Primary implementation scope:

- `apps/web`
- `apps/widget`
- `packages/convex`

Reference/compatibility scope (must not break while executing primary slices):

- `apps/mobile`
- `packages/sdk-core`
- `packages/react-native-sdk`

## New High-Priority Slices Surfaced In This Pass

1. Web outbound editor remains a monolith and still carries local outbound contract definitions (`apps/web/src/app/outbound/[id]/page.tsx`).
2. Web tour editor remains a monolith and duplicates tour-step contract semantics (`apps/web/src/app/tours/[id]/page.tsx`).
3. Outbound click-action/button/trigger contracts are still duplicated across web, widget, sdk-core, RN SDK, and Convex.
4. Widget still has two large runtime orchestrators after prior decomposition (`apps/widget/src/Widget.tsx`, `apps/widget/src/TourOverlay.tsx`).
5. Convex runtime concentration remains high in tour and series domains (`packages/convex/convex/tourProgress.ts`, `packages/convex/convex/series/runtime.ts`, `packages/convex/convex/series/authoring.ts`).
6. Convex workspace and messenger settings domains are still high-concentration multi-responsibility files.
7. Settings security + auth policy editing remains concentrated in web settings sections (`apps/web/src/app/settings/SecuritySettingsSection.tsx`).
8. Audience-rule editing logic is still concentrated in one large frontend component (`apps/web/src/components/AudienceRuleBuilder.tsx`).

## Remaining Slice Backlog (Priority Order)

| Priority | Slice | Why this still matters | Primary files | Suggested OpenSpec change |
|---|---|---|---|---|
| P0 | Centralize outbound + trigger contracts | Removes drift across authoring, delivery, and SDK consumers for click actions, buttons, and trigger definitions. | `apps/web/src/app/outbound/[id]/page.tsx`, `apps/widget/src/OutboundOverlay.tsx`, `packages/sdk-core/src/api/outbound.ts`, `packages/react-native-sdk/src/hooks/useOutboundMessages.ts`, `packages/convex/convex/outboundMessages.ts`, `packages/convex/convex/schema/outboundSupportTables.ts` | `centralize-outbound-and-trigger-contracts` |
| P0 | Decompose web outbound editor | Current editor mixes fetch/mutation orchestration, state normalization, action mapping, and preview rendering in one file. | `apps/web/src/app/outbound/[id]/page.tsx` | `decompose-web-outbound-editor` |
| P0 | Decompose web tour editor | Current editor mixes step CRUD, selector-quality diagnostics, and settings UI orchestration in one file. | `apps/web/src/app/tours/[id]/page.tsx` | `decompose-web-tour-editor` |
| P0 | Decompose widget shell orchestration (phase 2) | `Widget.tsx` still owns cross-overlay arbitration and stateful runtime sequencing. | `apps/widget/src/Widget.tsx` | `decompose-widget-shell-orchestration-v2` |
| P0 | Decompose widget tour runtime controller (phase 2) | `TourOverlay.tsx` still couples progression API calls, observer/viewport logic, route matching, and rendering decisions. | `apps/widget/src/TourOverlay.tsx`, `apps/widget/src/tourOverlay/*` | `decompose-widget-tour-runtime-v2` |
| P0 | Split Convex `tourProgress` domain | High mutation/query concentration with duplicated route/step progression logic increases change blast radius. | `packages/convex/convex/tourProgress.ts` | `split-convex-tour-progress-domain` |
| P0 | Split Convex series runtime/authoring (phase 2) | Series logic remains split only partially; runtime and authoring modules are still large and multi-responsibility. | `packages/convex/convex/series/runtime.ts`, `packages/convex/convex/series/authoring.ts` | `split-convex-series-runtime-authoring-v2` |
| P0 | Decompose Convex workspace admin domains | Workspace lifecycle + onboarding + invitations/membership remain concentrated and tightly coupled. | `packages/convex/convex/workspaces.ts`, `packages/convex/convex/workspaceMembers.ts` | `decompose-convex-workspace-admin-domains` |
| P0 | Decompose Convex messenger settings domain (phase 2) | Messaging settings and home-config mutations remain in one dense file; hard to evolve safely across surfaces. | `packages/convex/convex/messengerSettings.ts`, `apps/web/src/app/settings/MessengerSettingsSection.tsx`, `apps/web/src/app/settings/HomeSettingsSection.tsx`, `apps/widget/src/components/Home.tsx`, `packages/react-native-sdk/src/components/OpencomHome.tsx` | `decompose-convex-messenger-settings-v2` |
| P0 | Add cross-surface compatibility gates before P0 moves | Prevents contract drift from breaking mobile + sdk consumers while refactors proceed in web/widget/convex. | `apps/mobile`, `packages/sdk-core`, `packages/react-native-sdk` (contract tests/type gates) | `add-cross-surface-compatibility-gates` |
| P1 | Decompose Convex AI agent domain | Settings, runtime diagnostics, feedback, handoff, and analytics remain in one large module pair. | `packages/convex/convex/aiAgent.ts`, `packages/convex/convex/aiAgentActions.ts` | `decompose-convex-ai-agent-domain` |
| P1 | Decompose Convex email channel domain | Parsing, inbound processing, thread linking, delivery status, and provider send logic remain tightly coupled. | `packages/convex/convex/emailChannel.ts` | `decompose-convex-email-channel-domain` |
| P1 | Decompose Convex articles domain (phase 2) | Authoring, assets, feedback, and visitor delivery/search paths remain mixed. | `packages/convex/convex/articles.ts` | `decompose-convex-articles-domain-v2` |
| P1 | Decompose Convex help-center sync pipeline (phase 2) | Import sync logic remains large and dense even after first decomposition pass. | `packages/convex/convex/helpCenterImports/syncPipeline.ts` | `decompose-convex-help-center-sync-pipeline-v2` |
| P1 | Decompose web campaigns + knowledge admin surfaces | Both pages remain large and likely benefit from domain-controller extraction similar to completed web slices. | `apps/web/src/app/campaigns/page.tsx`, `apps/web/src/app/knowledge/page.tsx` | `decompose-web-campaigns-and-knowledge` |
| P1 | Decompose web settings security/auth sections (phase 2) | Security/signup/policy behavior remains concentrated and hard to test in isolation. | `apps/web/src/app/settings/SecuritySettingsSection.tsx`, `apps/web/src/app/settings/page.tsx` | `decompose-web-settings-security-v2` |
| P1 | Decompose inbox thread pane render/controller mix | Conversation detail rendering and action orchestration remain concentrated in one large pane module. | `apps/web/src/app/inbox/InboxThreadPane.tsx` | `decompose-web-inbox-thread-pane` |
| P1 | Decompose widget outbound + authoring overlays | Overlay controllers still mix trigger/time/scroll runtime logic with rendering branches. | `apps/widget/src/OutboundOverlay.tsx`, `apps/widget/src/AuthoringOverlay.tsx`, `apps/widget/src/TooltipAuthoringOverlay.tsx` | `decompose-widget-outbound-and-authoring-overlays` |
| P1 | Consolidate survey runtime primitives across widget + RN SDK | Survey answer normalization/flow helpers still diverge between widget and RN paths. | `apps/widget/src/surveyOverlay/answers.ts`, `apps/widget/src/surveyOverlay/types.ts`, `packages/react-native-sdk/src/components/survey/surveyFlow.ts`, `packages/react-native-sdk/src/components/survey/types.ts`, `packages/sdk-core/src/utils/surveyDelivery.ts` | `centralize-survey-runtime-primitives` |
| P1 | Split high-concentration Convex schema fragments (remaining) | `campaignTables` and `operationsTables` still carry dense union-heavy schema declarations. | `packages/convex/convex/schema/campaignTables.ts`, `packages/convex/convex/schema/operationsTables.ts` | `split-convex-schema-high-concentration-tables` |
| P2 | Decompose audience-rule builder/editor internals | Builder still mixes complex recursive state editing, validation UX, and type adaptation in a single component. | `apps/web/src/components/AudienceRuleBuilder.tsx`, `apps/web/src/lib/audienceRules.ts`, `packages/types/src/index.ts` | `decompose-audience-rule-builder-internals` |
| P2 | Shared route/URL/trigger matching utility convergence | Similar matching behavior currently lives in multiple places with different edge-case handling. | `packages/convex/convex/tourProgress.ts`, `apps/widget/src/tourOverlay/routeMatching.ts`, `packages/sdk-core/src/utils/surveyDelivery.ts`, `packages/convex/convex/outboundMessages.ts` | `unify-route-and-trigger-matching` |
| P2 | Cleanup dead/unused UI abstractions | Removes confusing dead paths and reduces future drift. | `apps/web/src/components/TriggerConfigEditor.tsx`, `apps/web/src/components/CollapsibleSection.tsx`, `apps/widget/src/components/WidgetContext.tsx` | `remove-dead-ui-abstractions` |
| P2 | Optional reference-surface decomposition after primary tracks | Not required to unblock core refactor, but still valuable long-term for maintainability. | `apps/mobile/app/(app)/settings.tsx`, `packages/react-native-sdk/src/components/OpencomOutbound.tsx` | `decompose-reference-surface-hotspots` |

## Cross-App Implications (Mobile + sdk-core + RN SDK)

Plan shape does not change after this pass. The required execution constraints remain:

1. Preserve exported `@opencom/sdk-core` and `@opencom/react-native-sdk` APIs while moving internals.
2. Keep Convex public/visitor-facing function refs backward-compatible during transitions.
3. Keep DOM-specific logic out of sdk-core shared utilities.
4. Gate P0/P1 slices with focused contract tests in sdk-core/RN and mobile typecheck checks.

## Suggested Future Execution Order

1. `add-cross-surface-compatibility-gates`
2. `centralize-outbound-and-trigger-contracts`
3. `decompose-web-outbound-editor`
4. `decompose-web-tour-editor`
5. `decompose-widget-shell-orchestration-v2`
6. `decompose-widget-tour-runtime-v2`
7. `split-convex-tour-progress-domain`
8. `split-convex-series-runtime-authoring-v2`
9. `decompose-convex-workspace-admin-domains`
10. `decompose-convex-messenger-settings-v2`
11. Run P1 slices in dependency order.
12. Run P2 cleanup and optional reference-surface decomposition.
