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
- Convex campaign delivery domains decomposition (`convex`)
- Widget tour overlay controller decomposition (`widget`)
- Widget shell controller decomposition (`widget`)
- Widget conversation view decomposition (`widget`)
- Widget survey overlay decomposition (`widget`)
- Convex auth-wrapper adoption (`convex`)

Open active OpenSpec changes unrelated to this refactor map (product tracks) remain in progress:

- `publish-mobile-sdk-packages-and-release-pipeline`
- `parity-mobile-inbox-ai-review-and-visitors`
- `ai-autotranslate-conversation-language-support`
- `add-intercom-migration-wizard`
- SEO changes

## Remaining Refactors (Priority Order)

## Canonical High-Impact Slice List (Remaining)

No remaining canonical high-impact slices.

## 1) UI Decomposition: Web Monoliths (High)

No remaining web-admin monolith in this target list is above ~600 lines after current slices.

Recently reduced:

- `apps/web/src/app/inbox/page.tsx` now ~587 lines after render-section extraction.
- `apps/web/src/app/settings/page.tsx` now ~778 lines after domain extraction.
- `apps/web/src/app/surveys/[id]/page.tsx` now ~344 lines after tab + question-domain extraction.
- `apps/web/src/app/campaigns/series/[id]/page.tsx` now ~460 lines after pane extraction.
- `apps/web/src/app/articles/page.tsx` now ~577 lines after section extraction.

Recommended next proposal tracks:

- `centralize-trigger-and-outbound-contracts`
- `split-convex-schema-high-concentration-tables`

## 2) UI Decomposition: Widget Monoliths (High)

- `apps/widget/src/Widget.tsx` (~1285 lines after shell-frame decomposition)
- `apps/widget/src/TourOverlay.tsx` (~996 lines after controller decomposition; helper/view modules extracted)
- `apps/widget/src/components/ConversationView.tsx` (~515 lines after message/footer extraction)
- `apps/widget/src/SurveyOverlay.tsx` (~245 lines after survey renderer/container extraction)

Recommended next proposal tracks:

- `centralize-trigger-and-outbound-contracts`
- `split-convex-schema-high-concentration-tables`

## 3) Convex Domain Decomposition (High)

Highest concentration modules:

- `packages/convex/convex/schema/campaignTables.ts` (~538 lines)
- `packages/convex/convex/schema/operationsTables.ts` (~417 lines)
- `packages/convex/convex/carousels/authoring.ts` (~307 lines)
- `packages/convex/convex/surveys/authoring.ts` (~364 lines)

Recommended next proposal tracks:

- `centralize-trigger-and-outbound-contracts`
- `split-convex-schema-high-concentration-tables`

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
8. Campaign-delivery decomposition highlights generated API type-depth limits in large module graphs.
   - Wrapper-level `runQuery/runMutation` call sites may require bounded typing strategies to keep downstream package typechecks stable.
9. Widget tour-overlay decomposition confirms view extraction can preserve behavioral selectors while reducing controller concentration.
   - Keeping mutation/scroll orchestration local while moving render branches lowers blast radius without changing external contracts.
10. Widget shell decomposition confirms shell chrome (header/nav/unread cues) can be separated without changing routing or overlay sequencing.
   - Shared tab-header/tab-resolution helpers reduce duplication and make shell behavior easier to reason about.
11. Conversation-view decomposition confirms large message/footer render branches can be extracted without changing AI/handoff behavior.
   - Keeping actions/queries in the controller while delegating render branches significantly lowers change blast radius.
12. Survey-overlay decomposition confirms question-renderer extraction can retain survey interaction behavior while reducing controller concentration.
   - Answer normalization and question/container rendering now have clear module boundaries for future changes.
13. Convex auth-wrapper adoption completed without endpoint contract drift across targeted domains.
   - Wrapper adoption and resolver-based workspace authorization can be expanded while preserving intentional soft-fail read behavior.

## Suggested Immediate Next Refactor

1. Start `centralize-trigger-and-outbound-contracts` for medium-priority cross-surface contract convergence.
2. Follow with `split-convex-schema-high-concentration-tables` to reduce remaining schema concentration risk.
