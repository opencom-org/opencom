# Refactor Remaining Map (2026-03-05)

## Current Status Snapshot

Recently completed slices:

- Web inbox orchestration modularity (`web`, archived OpenSpec change)
- Web inbox render sections (`web`)
- Shared home config contracts (`types + convex + web + widget`)
- Shared visitor readable ID generator (`types + convex + web`)
- Audience rule contract alignment and web typecheck recovery (`types + web`)
- Web settings page domain decomposition (`web`)
- Web survey editor decomposition (`web`)
- Web series editor decomposition (`web`)
- Web articles admin decomposition (`web`)
- Convex schema domain fragmentation (`convex`)
- Convex visitors domain decomposition (`convex`)
- Convex reporting domain decomposition (`convex`)

Open active OpenSpec changes unrelated to this refactor map (product tracks) remain in progress:

- `publish-mobile-sdk-packages-and-release-pipeline`
- `parity-mobile-inbox-ai-review-and-visitors`
- `ai-autotranslate-conversation-language-support`
- `add-intercom-migration-wizard`
- SEO changes

## Remaining Refactors (Priority Order)

## Canonical High-Impact Slice List (Remaining)

1. `decompose-widget-shell-controller` (`apps/widget/src/Widget.tsx`)
2. `decompose-widget-tour-overlay-controller` (`apps/widget/src/TourOverlay.tsx`)
3. `decompose-widget-conversation-view` (`apps/widget/src/components/ConversationView.tsx`)
4. `decompose-widget-survey-overlay` (`apps/widget/src/SurveyOverlay.tsx`)
5. `decompose-convex-campaign-delivery-domains` (`packages/convex/convex/carousels.ts` + `packages/convex/convex/surveys.ts`)
6. `expand-convex-auth-wrapper-adoption` (`workspaces.ts`, `workspaceMembers.ts`, `identityVerification.ts`, `segments.ts`, `assignmentRules.ts`, `commonIssueButtons.ts`)

## 1) UI Decomposition: Web Monoliths (High)

No remaining web-admin monolith in this target list is above ~600 lines after current slices.

Recently reduced:

- `apps/web/src/app/inbox/page.tsx` now ~587 lines after render-section extraction.
- `apps/web/src/app/settings/page.tsx` now ~778 lines after domain extraction.
- `apps/web/src/app/surveys/[id]/page.tsx` now ~344 lines after tab + question-domain extraction.
- `apps/web/src/app/campaigns/series/[id]/page.tsx` now ~460 lines after pane extraction.
- `apps/web/src/app/articles/page.tsx` now ~577 lines after section extraction.

Recommended next proposal tracks:

- `decompose-widget-shell-controller`
- `decompose-convex-campaign-delivery-domains`

## 2) UI Decomposition: Widget Monoliths (High)

- `apps/widget/src/Widget.tsx` (~1427 lines)
- `apps/widget/src/TourOverlay.tsx` (~1428 lines)
- `apps/widget/src/components/ConversationView.tsx` (~830 lines)
- `apps/widget/src/SurveyOverlay.tsx` (~723 lines)

Recommended next proposal tracks:

- `decompose-widget-tour-overlay-controller`
- `decompose-widget-conversation-view`

## 3) Convex Domain Decomposition (High)

Highest concentration modules:

- `packages/convex/convex/carousels.ts` (~1038 lines)
- `packages/convex/convex/surveys.ts` (~968 lines)
- `packages/convex/convex/schema/campaignTables.ts` (~538 lines)
- `packages/convex/convex/schema/operationsTables.ts` (~417 lines)

Recommended next proposal tracks:

- `decompose-convex-campaign-delivery-domains`
- `expand-convex-auth-wrapper-adoption`

## 4) Cross-Surface Contract Convergence (Medium)

- Continue replacing web-local domain contracts with shared `@opencom/types` contracts where backend validators already define stable payload shapes.
- Candidate next targets:
  - trigger config contracts
  - outbound message button/click-action contracts
  - tour step authoring payload contracts

Recommended proposal track:

- `centralize-trigger-and-outbound-contracts`

## Major New Findings Confirmed In This Slice

1. Audience-rule depth constraints were not explicit in web editor behavior.
   - Backend validators effectively support bounded nesting; web now needs explicit UI guardrails to stay within contract.
2. Segment targeting support is not uniform across endpoints.
   - Outbound is inline-only while campaign/tour surfaces are segment-capable.
   - This needs explicit product and API boundary documentation to prevent future drift.
3. Union payload handling in article import/export paths benefits from strict narrowing.
   - This is a recurring pattern to enforce in other import/export domains.
4. Decomposition of web monolith pages is no longer the top concentration risk.
   - Highest-impact remaining slices are now widget controllers and Convex domain files.
5. Schema contract decomposition surfaced a notification preference drift.
   - `push` notification channel support must remain explicit in schema validators and dependent settings code.
6. Visitors-domain extraction confirms re-export entrypoints are safe for Convex API stability.
   - Domain modules can be decomposed without changing generated API names/signatures.
7. Reporting-domain extraction confirms the same re-export pattern scales across query/mutation-heavy modules.
   - Shared helper modules can absorb auth/limit/date logic without endpoint contract drift.

## Suggested Immediate Next Refactor

1. Start `decompose-convex-campaign-delivery-domains` while convex decomposition patterns are fresh.
2. Follow with `decompose-widget-tour-overlay-controller` to reduce client-side controller complexity.
