# Refactor Assessment: Web + Widget + Convex (2026-03-05)

## Scope

- Primary: `apps/web`, `apps/widget`, `packages/convex`
- Reference-only for convergence: `apps/mobile`, `packages/react-native-sdk`, `packages/sdk-core`, `packages/types`

## Executive Summary

The codebase already has strong building blocks (`@opencom/sdk-core`, `@opencom/types`, Convex auth wrappers), but core business logic is still duplicated across frontends and mixed into large UI containers.

The highest-ROI path is:

1. Consolidate shared business contracts and defaults (settings, home config, audience rules, identity labels, markdown safety).
2. Extract orchestration logic out of large pages/components into reusable domain hooks.
3. Standardize Convex auth/permission patterns and public/private endpoint contracts.

## Cross-App Compatibility Verdict (Mobile + sdk-core + RN SDK)

Plan shape does **not** need to change. The same three tracks remain correct.

What does need to change is execution guardrails:

1. Keep SDK/public contracts stable while extracting shared logic.
   - `@opencom/react-native-sdk` re-exports many `@opencom/sdk-core` types and hook/component contracts.
2. Keep platform boundaries explicit.
   - DOM-dependent logic (markdown/sanitization) should stay out of `@opencom/sdk-core`.
3. Preserve Convex public endpoint compatibility during naming cleanup.
   - Some visitor-facing consumers use `getOrCreate`/`get` inconsistently today.
4. Preserve URL-validation semantics by surface.
   - Mobile backend discovery (`@opencom/types`) and sdk-core client init (`validateConvexUrl`) have different security rules and should not be merged blindly.

## Key Signals

- Large files (>= 500 lines):
  - `apps/web`: 17 files
  - `apps/widget`: 5 files
  - `packages/convex/convex`: 33 files
- Largest hotspots:
  - `apps/web/src/app/inbox/page.tsx` (1732 lines)
  - `apps/widget/src/Widget.tsx` (1413 lines)
  - `packages/convex/convex/series.ts` (2429 lines)
- React health scan (`react-doctor`):
  - Web: **78/100**, 2 errors, 379 warnings, 66/129 files
  - Widget: **87/100**, 2 errors, 53 warnings, 17/61 files

## Ranked Opportunities

| Rank | Opportunity | Why It Matters | Impact | Effort |
|---|---|---|---|---|
| 1 | Centralize messenger/home settings contracts and defaults | Same domain model/defaults are implemented in Convex + web + widget + RN, causing drift risk | High | Medium |
| 2 | Split `apps/web/src/app/inbox/page.tsx` into domain hooks + presentational components | Heavy state/effects/query orchestration and notification side effects in one page | High | Medium |
| 3 | Split `apps/widget/src/Widget.tsx` shell into feature controllers | Shell owns sessions, navigation, data loading, overlay arbitration, and rendering | High | Medium |
| 4 | Unify markdown/sanitization pipeline across web + widget | Security-sensitive parser/sanitizer logic is near-duplicate and test coverage is fragmented | High | Low |
| 5 | Standardize Convex auth/permission handling via wrappers/services | Mixed manual checks and wrapper usage increases inconsistency and audit surface | High | Medium |
| 6 | Unify audience-rule type contract (frontend/backed) | Same concept is typed in multiple places with local variants and casts | High | Medium |
| 7 | Unify unread cue engine (web inbox + widget) | Same unread-snapshot/increase/suppression model reimplemented with small variations | Medium | Low |
| 8 | Consolidate workspace/backend selection logic across web + mobile | Duplicate backend/auth/workspace-resolution flows diverge by platform | Medium | Medium |
| 9 | Extract visitor identity label generator into shared package | Deterministic wordlists are duplicated byte-for-byte in web + Convex | Medium | Low |
| 10 | Clean up abandoned/partial abstractions | Unused `WidgetContext`, unused web components, unused Convex validation utilities add confusion | Medium | Low |
| 11 | Add cross-surface compatibility gates (mobile + sdk-core + RN SDK) | Prevents refactors in web/widget/convex from silently breaking SDK consumers and mobile routing/auth flows | High | Low |

## Suggested First 3 Execution Tracks

1. **Shared contracts track**
   - Move settings/home/audience/identity contracts into shared packages.
   - Keep Convex as runtime authority; clients consume shared schema/types/defaults.

2. **UI decomposition track**
   - Start with `web/inbox` and `widget/Widget`.
   - Introduce domain hooks (`useInboxController`, `useWidgetShellController`) and thin render layers.

3. **Convex consistency track**
   - Expand auth wrappers into remaining manual modules.
   - Enforce explicit naming for public endpoints (`getPublic*`) vs auth-required endpoints.

## Detailed Evidence

See:

- `docs/refactor-assessment-evidence-2026-03-05.md`
- `docs/refactor-assessment-roadmap-2026-03-05.md`
