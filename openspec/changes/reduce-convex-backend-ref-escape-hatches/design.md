## Context

The broader Convex ref-hardening work already removed many backend dynamic ref patterns, but the March 11, 2026 scan shows five remaining hotspot shapes:

- `packages/convex/convex/aiAgentActions.ts`
  - shallow `ctx.runQuery` / `ctx.runMutation` casts plus broad `unsafeInternalApi` and `unsafeApi` object-cast ref selection
- `packages/convex/convex/outboundMessages.ts`
  - shallow `ctx.runQuery` / `ctx.runMutation` casts plus `unsafeApi` and `unsafeInternal` object-cast ref selection
- `packages/convex/convex/carousels/triggering.ts`
  - shallow `ctx.runQuery` / `ctx.runMutation` casts plus inline `anyApi` object-cast ref selection
- `packages/convex/convex/widgetSessions.ts`
  - a narrow but still ad hoc `ctx.runMutation as unknown as ...` boundary for identity verification
- `packages/convex/convex/push.ts`
  - explicit fixed refs already exist, but they are still layered on repeated `as unknown as InternalFunctionRef<...>` casts and shallow runner helpers

The goal is not to remove every backend `as unknown as` in the repo. The goal is to make the residual backend escape hatches explicit, small, and easy to guard.

## Goals / Non-Goals

**Goals:**

- Replace broad object-cast ref selection with explicit fixed refs or narrowly scoped helper modules in covered hotspots.
- Keep any remaining `TS2589` workaround small, named, and easy to audit.
- Extend backend guardrails so the approved hotspot inventory stays explicit.
- Preserve all existing runtime behavior, permission rules, and scheduling semantics.

**Non-Goals:**

- Removing every `as unknown as` usage in `packages/convex`.
- Rewriting unrelated existing helper modules that are already explicit and stable enough for their current scope.
- Changing backend business logic, permissions, or output contracts as part of the boundary cleanup.

## Decisions

### 1) Prefer explicit fixed refs over wide object-cast selectors

Decision:

- Replace `unsafeApi` / `unsafeInternal` object-cast access patterns in covered modules with fixed named refs or dedicated local ref helper modules.

Rationale:

- The current hotspot problem is breadth. A wide object-cast view of `anyApi` exposes multiple unrelated targets at once and hides exactly which functions are actually in use.
- Fixed refs make each target explicit without requiring generated `api.*` property access at the hot spot.

Alternatives considered:

- Keep the broad object-cast selectors because typecheck currently passes. Rejected because these are the least constrained remaining boundaries and the user explicitly wants follow-on cleanup options.

### 2) Keep shallow runner casts, but normalize their shape

Decision:

- Continue to allow shallow `ctx.runQuery`, `ctx.runMutation`, and `ctx.runAction` casts in covered hotspots when they are the smallest practical `TS2589` escape hatch.
- Where a file uses several such calls, wrap the cast in a named helper rather than repeating anonymous cast blocks inline.

Rationale:

- The cast itself is not necessarily the regression. The regression is when broad ref selection and broad runner casts accumulate together in feature logic.

Alternatives considered:

- Ban shallow runner casts entirely. Rejected because some hotspot files still need them to stay typecheck-safe.

### 3) Guard the residual hotspot inventory explicitly

Decision:

- Add or extend backend guard tests so new broad `unsafeApi` / `unsafeInternal` patterns or expanded hotspot files must be deliberate rather than accidental.

Rationale:

- Without a guardrail, a tactical hotspot cleanup can decay back into an invisible repo-wide pattern.

### 4) Migrate the widest hotspots first

Decision:

- Refactor `aiAgentActions.ts`, `outboundMessages.ts`, and `carousels/triggering.ts` before tightening `widgetSessions.ts` and `push.ts`.

Rationale:

- The first group still uses wide object-cast selectors and has the highest payoff.
- `push.ts` and `widgetSessions.ts` already have narrower shapes and can be treated as follow-on polish within the same change.

## Risks / Trade-offs

- [Risk] Forcing narrower ref declarations could re-trigger `TS2589` in covered modules.
  - Mitigation: keep the workaround on explicit fixed refs or named shallow runner helpers instead of restoring wide object-cast selectors.
- [Risk] Guardrails could become too rigid and block legitimate new hotspots.
  - Mitigation: allow a deliberate inventory update when a justified exception is documented in the change.
- [Risk] Refactoring multi-call runtime modules could subtly change sequencing or error handling.
  - Mitigation: preserve behavior with targeted domain tests for AI agent actions, outbound messages, widget sessions, carousels, and push-related guards.

## Migration Plan

1. Freeze the March 11, 2026 hotspot inventory and define the preferred helper shape for each file.
2. Replace broad object-cast selectors in `aiAgentActions.ts`, `outboundMessages.ts`, and `carousels/triggering.ts`.
3. Tighten `widgetSessions.ts` and `push.ts` where explicit helpers can carry the same contract.
4. Update backend hardening guards so residual exceptions stay explicit.
5. Run `pnpm --filter @opencom/convex typecheck` plus targeted Convex tests for touched hotspots and guards.
6. Run strict OpenSpec validation for this change.

Rollback:

- Revert only the current hotspot batch if it destabilizes typecheck or domain behavior. Do not reintroduce the broad object-cast selector pattern across all hotspots as the default fallback.

## Open Questions

- Should the final approved hotspot inventory live only in the guard tests, or also in a shared backend hardening helper comment block for faster review?
