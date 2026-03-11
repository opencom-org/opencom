## Why

`ConversationView` render-path tests in the widget currently hang at suite startup under Vitest/JSDOM, which blocks reliable widget test verification and obscures regressions behind a non-diagnostic timeout. The rest of the widget and related web suites can now be stabilized with the timeout runner, so this remaining blocker should be documented and narrowed with a dedicated follow-up path.

## What Changes

- Document the confirmed `ConversationView` investigation results, including what was fixed elsewhere and what remains unresolved in the widget render-path test seam.
- Define a stabilization path for `ConversationView` widget tests that separates import-level verification from render-path verification and makes future investigation reproducible.
- Update the widget conversation-view capability requirements so the component can be exercised in tests without suite-startup hangs.
- Capture the current mitigations and verification commands needed to resume work safely.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `widget-conversation-view-modularity`: The conversation view requirements now need explicit testability and verification constraints so render-path behavior can be validated without hanging the test runner.

## Impact

- OpenSpec change artifacts under `openspec/changes/stabilize-conversationview-widget-tests/`
- Widget test coverage and future implementation work for `apps/widget/src/components/ConversationView.tsx`
- Widget test files under `apps/widget/src/components/` and `apps/widget/src/test/`
- Repo-local verification workflow using `scripts/run-with-timeout.js` and `pnpm test:timeout`
