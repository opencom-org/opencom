## Context

`ConversationView` in `apps/widget/src/components/ConversationView.tsx` remains the only known widget test surface from the recent timeout scan that still hangs at suite startup under Vitest/JSDOM. Multiple other widget and web suites were stabilized by updating Convex hook mocks to resolve `makeFunctionReference(...)` values by function path and by correcting stale assertions. Those fixes reduced the remaining inventory to the `ConversationView` render path.

The investigation established two important boundaries:

1. A lightweight import-only smoke test for `ConversationView` passes under the same test runner and mock environment.
2. Render-path behavior specs that attempt to mount `ConversationView` still hang at `0/x` tests even after heavy dependency mocking and reduction to a single active test case.

This means the remaining issue is not simple module import failure. It is an interaction in the component render/test seam under JSDOM, likely involving orchestration logic, effects, or child-component contracts that are still exercised once the component mounts.

## Goals / Non-Goals

### Goals

- Preserve a durable written record of the confirmed investigation results so future work starts from facts instead of repeating failed isolation attempts.
- Stabilize the widget test baseline by keeping import-level verification available while the render-path hang remains quarantined.
- Define a concrete implementation path for reintroducing render-path coverage through smaller seams that are resilient under Vitest/JSDOM.
- Preserve the existing `ConversationView` runtime contracts expected by the widget shell and related tests.

### Non-Goals

- Fully solve the `ConversationView` render-path hang in this documentation-only change.
- Change widget runtime behavior or public props in ways unrelated to testability.
- Broaden the timeout runner scope beyond the existing repo-local test workflow.

## Current Findings

### Confirmed passing investigation paths

- `scripts/run-with-timeout.js` reliably terminates hanging focused test runs and distinguishes hangs from normal failures.
- The following suites were stabilized and verified after updating Convex mock resolution or assertions:
  - `apps/widget/src/test/widgetTourBridgeLifecycle.test.tsx`
  - `apps/widget/src/test/widgetShellOrchestration.test.tsx`
  - `apps/widget/src/test/widgetTourStart.test.tsx`
  - `apps/widget/src/test/widgetNewConversation.test.tsx`
  - `apps/widget/src/test/widgetTicketErrorFeedback.test.tsx`
  - `apps/widget/src/test/tourOverlay.test.tsx`
  - `apps/web/src/app/settings/MessengerSettingsSection.test.tsx`
  - `apps/web/src/app/articles/[id]/page.test.tsx`
- `apps/widget/src/components/ConversationView.import.test.ts` passes, proving the component module can be imported when mocks are established.

### Confirmed failing or hanging paths

- `apps/widget/src/components/ConversationView.test.tsx` hangs at `0/8` tests under timeout-based execution.
- Reducing the spec to a single active `it.only(...)` still hangs at suite startup.
- Replacing eager import with lazy import after mock setup does not remove the hang.
- A reduced replacement behavior spec that mounts `ConversationView` also hangs at `0/x` under the timeout runner.

### Investigation implications

- The unresolved issue is tied to mounting/rendering `ConversationView`, not importing it.
- The remaining fault domain likely includes mount-time orchestration, effects, or JSDOM-visible child contracts rather than only Convex function-reference mocking.
- Further work should avoid restarting from the full monolithic spec and instead use intentionally small seams with explicit mount boundaries.

## Proposed Technical Direction

### 1. Preserve a stable baseline

Keep import-smoke coverage active so the test suite still verifies that `ConversationView` remains importable with current dependency boundaries. Keep timeout-based commands as the first verification step for any renewed `ConversationView` work.

### 2. Re-enter render coverage through narrower seams

Future implementation should break the render-path investigation into isolated seams, for example:

- extract mount-time orchestration/effects into a hook or controller that can be unit tested without DOM rendering
- test render-only subviews against plain props and fixture data
- reintroduce integrated `ConversationView` mount coverage only after the effect-heavy logic has a smaller surface area

The existing spec for widget conversation-view modularity already expects orchestration and render concerns to be separable; the testability gap now makes that expectation operationally necessary.

### 3. Use timeout-driven checkpoints

Every attempted `ConversationView` change should be verified in this order:

1. import smoke
2. the smallest new focused seam test
3. focused widget suite(s)
4. broader widget inventory only after the focused seam passes

This preserves signal and avoids waiting on another long opaque stall.

## Risks and Tradeoffs

- Quarantining render-path tests preserves suite stability but temporarily reduces direct behavioral regression coverage on `ConversationView`.
- Refactoring for test seams may touch orchestration code that currently works in production, so contract-preserving tests around props, selectors, and widget shell integration are important.
- Keeping a monolithic integration spec as the main investigation surface is high-risk because it repeatedly fails before yielding actionable diagnostics.

## Verification Strategy

Current reproducible verification commands:

- `pnpm test:timeout --timeout-ms 45000 --cwd /Users/jack/dev/Repos/opencom-prod ./node_modules/.bin/vitest run apps/widget/src/components/ConversationView.import.test.ts`
- `pnpm test:timeout --timeout-ms 45000 --cwd /Users/jack/dev/Repos/opencom-prod ./node_modules/.bin/vitest run apps/widget/src/components/ConversationView.test.tsx`
- `pnpm test:timeout --timeout-ms 60000 --cwd /Users/jack/dev/Repos/opencom-prod ./node_modules/.bin/vitest run apps/widget/src/test/widgetTourBridgeLifecycle.test.tsx apps/widget/src/test/widgetShellOrchestration.test.tsx`

Future implementation should add smaller focused tests that can be run with the same timeout workflow before restoring any broad integrated `ConversationView` render suite.
