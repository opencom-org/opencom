# Refactor Remaining Map (2026-03-05)

## Current Status Snapshot

Recently completed slices:

- Web inbox orchestration modularity (`web`, archived OpenSpec change)
- Shared home config contracts (`types + convex + web + widget`)
- Shared visitor readable ID generator (`types + convex + web`)
- Audience rule contract alignment and web typecheck recovery (`types + web`)
- Web settings page domain decomposition (`web`)
- Web survey editor decomposition (`web`)

Open active OpenSpec changes unrelated to this refactor map (product tracks) remain in progress:

- `publish-mobile-sdk-packages-and-release-pipeline`
- `parity-mobile-inbox-ai-review-and-visitors`
- `ai-autotranslate-conversation-language-support`
- `add-intercom-migration-wizard`
- SEO changes

## Remaining Refactors (Priority Order)

## Canonical High-Impact Slice List (Remaining)

1. `decompose-web-inbox-render-sections` (`apps/web/src/app/inbox/page.tsx`)
2. `decompose-web-series-editor` (`apps/web/src/app/campaigns/series/[id]/page.tsx`)
3. `decompose-web-articles-admin-page` (`apps/web/src/app/articles/page.tsx`)
4. `decompose-widget-shell-controller` (`apps/widget/src/Widget.tsx`)
5. `decompose-widget-tour-overlay-controller` (`apps/widget/src/TourOverlay.tsx`)
6. `decompose-widget-conversation-view` (`apps/widget/src/components/ConversationView.tsx`)
7. `decompose-widget-survey-overlay` (`apps/widget/src/SurveyOverlay.tsx`)
8. `split-convex-schema-domain-fragments` (`packages/convex/convex/schema.ts`)
9. `decompose-convex-visitors-domain` (`packages/convex/convex/visitors.ts`)
10. `decompose-convex-reporting-domain` (`packages/convex/convex/reporting.ts`)
11. `decompose-convex-campaign-delivery-domains` (`packages/convex/convex/carousels.ts` + `packages/convex/convex/surveys.ts`)
12. `expand-convex-auth-wrapper-adoption` (`workspaces.ts`, `workspaceMembers.ts`, `identityVerification.ts`, `segments.ts`, `assignmentRules.ts`, `commonIssueButtons.ts`)

## 1) UI Decomposition: Web Monoliths (High)

- `apps/web/src/app/inbox/page.tsx` (~1438 lines)
- `apps/web/src/app/campaigns/series/[id]/page.tsx` (~1204 lines)
- `apps/web/src/app/articles/page.tsx` (~1174 lines)

Recently reduced:

- `apps/web/src/app/settings/page.tsx` now ~778 lines after domain extraction.
- `apps/web/src/app/surveys/[id]/page.tsx` now ~344 lines after tab + question-domain extraction.

Recommended next proposal tracks:

- `decompose-web-inbox-render-sections`
- `decompose-web-series-editor`

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

- `packages/convex/convex/schema.ts` (~2026 lines)
- `packages/convex/convex/reporting.ts` (~1224 lines)
- `packages/convex/convex/visitors.ts` (~1070 lines)
- `packages/convex/convex/carousels.ts` (~1038 lines)
- `packages/convex/convex/surveys.ts` (~968 lines)

Recommended next proposal tracks:

- `split-convex-schema-domain-fragments`
- `decompose-convex-visitors-domain`
- `decompose-convex-reporting-domain`

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

## Suggested Immediate Next Refactor

1. Start `decompose-web-inbox-render-sections` (inbox orchestration hooks exist; remaining risk is render-layer monolith).
2. In parallel, draft `split-convex-schema-domain-fragments` to reduce backend coupling and review load.
