## Why

`apps/web/src/app/inbox/page.tsx` currently concentrates conversation selection, query-param synchronization, sidecar orchestration, notification cues, and message actions in one large file. This structure increases regression risk and slows contributor onboarding in one of the highest-impact agent workflows.

## What Changes

- Decompose inbox page orchestration into domain-focused hooks/modules (selection/query sync, suggestions/sidecar, attention cues, message actions).
- Keep the page as a thin composition layer that wires domain hooks and presentational sections.
- Preserve current behavior for URL state, compact panel behavior, unread cue suppression, and action handlers.
- Add targeted regression coverage for state synchronization and unread cue behavior.

## Capabilities

### New Capabilities
- `web-inbox-modularity`: Inbox behavior is implemented through explicit domain modules with stable contracts and isolated responsibilities.

### Modified Capabilities
- None.

## Impact

- Web inbox internals: `apps/web/src/app/inbox/page.tsx` plus new inbox hook/module files.
- Web tests: targeted tests for query sync, compact sidecar behavior, and unread cue logic.
- Contributor workflow: lower review scope and easier incremental changes in inbox features.
