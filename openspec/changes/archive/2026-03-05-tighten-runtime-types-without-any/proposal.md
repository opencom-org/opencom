## Why

Runtime-critical modules still rely on broad `as any` casts and `unknown` payloads in key paths (`authWrappers`, `events`, `series`, and shared types). These gaps reduce refactor safety and hide contract mismatches in code that drives scheduler, auth, and workflow execution.

## What Changes

- Replace unsafe casts in runtime-critical Convex paths with explicit typed adapters and helper contracts.
- Narrow broad `unknown` fields in shared types where runtime behavior relies on specific structure.
- Add type-focused tests/guards for affected runtime paths to prevent regressions.
- Document allowed escape hatches for unavoidable dynamic edges.

## Capabilities

### New Capabilities

- `runtime-type-safety-hardening`: Runtime-critical workflow/auth/event paths use explicit type contracts with reduced broad casting.

### Modified Capabilities

- None.

## Impact

- Convex runtime modules: `authWrappers.ts`, `events.ts`, `series.ts`.
- Shared type contracts in `packages/types/src/index.ts`.
- Type safety guardrails and tests for runtime-critical paths.
