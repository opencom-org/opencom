# Refactor Remaining Map (2026-03-05)

## Current Status Snapshot

Recently completed slices:

- Shared home config contracts (`types + convex + web + widget`)
- Shared visitor readable ID generator (`types + convex + web`)
- Audience rule contract alignment and web typecheck recovery (`types + web`)

Open active OpenSpec changes unrelated to this refactor map (product tracks) remain in progress:

- `publish-mobile-sdk-packages-and-release-pipeline`
- `parity-mobile-inbox-ai-review-and-visitors`
- `ai-autotranslate-conversation-language-support`
- `add-intercom-migration-wizard`
- SEO changes

## Remaining Refactors (Priority Order)

## 1) UI Decomposition: Web Monoliths (High)

- `apps/web/src/app/inbox/page.tsx` (~1438 lines)
- `apps/web/src/app/settings/page.tsx` (~1399 lines)
- `apps/web/src/app/surveys/[id]/page.tsx` (~1252 lines)
- `apps/web/src/app/campaigns/series/[id]/page.tsx` (~1204 lines)
- `apps/web/src/app/articles/page.tsx` (~1172 lines)

Recommended next proposal tracks:

- `decompose-web-settings-page-by-domain`
- `decompose-web-survey-editor`

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

1. Start `decompose-web-settings-page-by-domain` (high impact, contained blast radius).
2. In parallel, draft `split-convex-schema-domain-fragments` to reduce backend coupling and review load.
