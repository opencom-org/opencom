## Why

`packages/convex/convex/notifications.ts` currently bundles recipient resolution, debounce batching, channel dispatch, and many event-specific notification emitters into one large module. This increases maintenance cost and makes notification behavior changes risky and difficult to review.

## What Changes

- Decompose the notifications domain into focused modules (recipient resolution, event routing, email/push dispatch orchestration, event-specific emitters).
- Keep existing notification semantics intact for chat and ticket events, including debounce timing and routing outcomes.
- Replace broad context typing in notification helpers with explicit typed interfaces where possible.
- Add targeted regression tests for representative notification event flows and dedupe/debounce behavior.

## Capabilities

### New Capabilities
- `convex-notification-modularity`: Notification orchestration is implemented through domain modules with explicit contracts and preserved event semantics.

### Modified Capabilities
- None.

## Impact

- Convex backend internals: `packages/convex/convex/notifications.ts` split into notification submodules.
- Convex tests: expanded coverage for route-event behavior, recipient resolution, and debounced email dispatch paths.
- Contributor workflow: smaller, domain-scoped diffs for notification changes.
