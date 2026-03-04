## Context

The current RN SDK orchestrator accumulates many concerns in one file with module-level mutable state. This increases risk of subtle ordering bugs (initialization/lifecycle/push) and makes testing difficult because behavior is not isolated by responsibility.

## Goals / Non-Goals

**Goals:**
- Separate orchestration concerns into clear internal modules.
- Preserve existing public API signatures and behavior.
- Improve testability of lifecycle/session/push logic.
- Reduce shared mutable state surfaces.

**Non-Goals:**
- Changing SDK public API names in this change.
- Replacing push providers or external dependencies.

## Decisions

### 1) Keep stable facade, move logic behind services

Decision:
- Keep `OpencomSDK` as the public facade while delegating to internal modules: `sessionService`, `storageService`, `pushService`, `lifecycleService`.

Rationale:
- Minimizes adoption risk while unlocking internal modularity.

Alternatives considered:
- Break public API into multiple exported classes. Rejected for backward compatibility risk.

### 2) Centralize mutable state in a dedicated session store

Decision:
- Replace scattered module-level mutable state with a single internal state container consumed by services.

Rationale:
- Prevents divergent state mutation patterns and simplifies tests.

Alternatives considered:
- Keep per-module mutable globals. Rejected due to synchronization risk.

### 3) Contract tests for public API parity

Decision:
- Add tests that assert existing API calls still produce expected side effects and events.

Rationale:
- Ensures modularization remains behavior-preserving.

## Risks / Trade-offs

- [Risk] Refactor may change initialization ordering accidentally.
  - Mitigation: parity tests covering initialize/identify/register/lifecycle flows.
- [Risk] Extra indirection may add debugging overhead.
  - Mitigation: strict module contracts and concise internal tracing points.

## Migration Plan

1. Introduce internal services and shared state container.
2. Migrate one concern at a time behind stable facade methods.
3. Add/expand parity tests for each migrated concern.
4. Remove obsolete monolithic code paths.
5. Run RN SDK typecheck/tests and strict validation.

Rollback:
- Revert service extraction in slices while keeping facade behavior intact.

## Open Questions

- Should lifecycle timers move to a pluggable scheduler abstraction for tests in this change?
- Do we expose internal diagnostics hooks for host app debugging now or later?
