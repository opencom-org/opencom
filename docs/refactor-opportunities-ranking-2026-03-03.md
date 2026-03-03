# Refactor Opportunities Ranking (2026-03-03)

## Scope

- Included: `apps/web`, `apps/widget`, `apps/landing`, `packages/convex`, `packages/sdk-core`, `packages/types`, `packages/react-native-sdk`
- Excluded: native SDKs under `packages/ios-sdk` and `packages/android-sdk`

## Ranked Opportunities

1. **Split `apps/widget/src/Widget.tsx` and fix hook ordering immediately**
   - Why: Correctness risk plus major maintenance bottleneck in the highest-churn widget shell.
   - Evidence: `apps/widget/src/Widget.tsx` is 1675 lines with 26 `useState` refs and 16 `useEffect` refs; hook-order lint error at `apps/widget/src/Widget.tsx:1150` with early-return path at `apps/widget/src/Widget.tsx:1120`.

2. **Decompose `apps/web/src/app/inbox/page.tsx` into domain hooks/components**
   - Why: Too much state/effect/query orchestration in one file makes safe edits difficult.
   - Evidence: `apps/web/src/app/inbox/page.tsx` is 1652 lines with many independent effects (`:291`, `:340`, `:372`, `:410`, `:503`).

3. **Modularize Convex notifications domain**
   - Why: Delivery routing, email batching, and event-specific emitters are tightly coupled in a single module.
   - Evidence: `packages/convex/convex/notifications.ts` is 1603 lines; large orchestrator at `:1062` plus repeated event emitters from `:1308` onward.

4. **Split Convex series engine by responsibility**
   - Why: Authoring API + runtime progression + telemetry logic are mixed, raising change risk.
   - Evidence: `packages/convex/convex/series.ts` is 2429 lines with 26 exports; scheduler/runtime casts at `:1350`, `:1374`, `:2001`.

5. **Break up Help Center import/export pipeline**
   - Why: Path normalization, frontmatter parsing, asset rewrite, import, and export all sit in one module.
   - Evidence: `packages/convex/convex/helpCenterImports.ts` is 1993 lines; dense utility stack (`:40+`) and heavy handlers (`:645+`, `:1593+`).

6. **Extract shared markdown rendering/sanitization into a single package utility**
   - Why: Security-sensitive logic is duplicated across surfaces.
   - Evidence: near-duplicate implementations in `apps/web/src/lib/parseMarkdown.ts` and `apps/widget/src/utils/parseMarkdown.ts`.

7. **Unify notification-cue logic between web inbox and widget**
   - Why: Same mental model implemented twice with slight differences increases drift risk.
   - Evidence: `apps/web/src/lib/inboxNotificationCues.ts` and `apps/widget/src/lib/widgetNotificationCues.ts`.

8. **Normalize workspace lint tooling and quality gates**
   - Why: Inconsistent lint setup allows maintainability regressions.
   - Evidence: `apps/web/package.json` uses deprecated `next lint`; `packages/convex/package.json` has no lint script; root `package.json` has broken script `test:e2e:prod` (`pn` typo).

9. **Reduce `as any` / broad `unknown` usage in runtime-critical paths**
   - Why: Weak typing reduces refactor safety and editor assistance.
   - Evidence: runtime casts in `packages/convex/convex/lib/authWrappers.ts`, `packages/convex/convex/events.ts`, `packages/convex/convex/series.ts`; broad unknown fields in `packages/types/src/index.ts` (series/survey sections).

10. **Split oversized Convex test helper modules**
    - Why: Fixture discovery and extension are difficult with mega-files.
    - Evidence: `packages/convex/convex/testing/helpers.ts` (2605 lines), `packages/convex/convex/testData.ts` (3355 lines).

11. **`packages/react-native-sdk`: split `OpencomSDK.ts` into session, push, storage, lifecycle modules**
    - Why: Single orchestrator file mixes platform state management, persistence, push registration, and event wiring.
    - Evidence: `packages/react-native-sdk/src/OpencomSDK.ts` is 792 lines with global mutable module state and lifecycle timers.

12. **`packages/react-native-sdk`: decompose large UI containers (`OpencomSurvey`, `OpencomMessenger`)**
    - Why: Large multi-responsibility components slow changes and increase bug surface.
    - Evidence: `packages/react-native-sdk/src/components/OpencomSurvey.tsx` (888 lines), `OpencomMessenger.tsx` (739 lines), complex effect/state region around `OpencomMessenger.tsx:248-297`.

13. **`packages/react-native-sdk`: tighten type contracts across composed messenger views**
    - Why: `as any` escapes hide prop contract mismatches and make refactors brittle.
    - Evidence: `packages/react-native-sdk/src/components/MessengerContent.tsx:150-151` passes `as any` props into `OpencomMessenger`.

14. **Standardize frontend error UX (replace raw `alert` pattern)**
    - Why: Inconsistent UX and duplicated error handling paths.
    - Evidence: repeated `alert(...)` usage in `apps/web/src/app/settings/page.tsx`, `apps/web/src/app/settings/MessengerSettingsSection.tsx`, `apps/widget/src/Widget.tsx`.

## Top 3 For Immediate Proposal/Execution

1. `Widget.tsx` shell split + hook-order fix
2. Web inbox page decomposition
3. Convex notifications modularization
