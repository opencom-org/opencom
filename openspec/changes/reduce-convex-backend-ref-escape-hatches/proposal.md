## Why

Workspace typecheck now passes, but a March 11, 2026 repo scan still found concentrated backend escape-hatch hotspots in `aiAgentActions.ts`, `outboundMessages.ts`, `carousels/triggering.ts`, `push.ts`, and `widgetSessions.ts`. These modules rely on `unsafeApi` / `unsafeInternal` object casts or broad `as unknown as` boundaries that are acceptable as tactical `TS2589` workarounds, but they remain the least constrained backend Convex ref boundaries.

## What Changes

- Replace broad `unsafeApi` / `unsafeInternal` object casts in covered Convex runtime modules with explicit fixed refs or narrowly typed helper modules where feasible.
- Standardize the remaining shallow `ctx.runQuery`, `ctx.runMutation`, and `ctx.runAction` escape hatches so covered modules use a documented boundary shape rather than ad hoc local casts.
- Extend backend guardrails to pin the allowed residual escape-hatch inventory and prevent new broad dynamic ref patterns from spreading.
- Preserve runtime behavior, permission checks, scheduling semantics, and existing accepted `TS2589` workarounds where a narrower boundary is still not practical.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `convex-function-ref-boundaries`: Tighten the rules for residual backend escape hatches so covered hotspots prefer fixed refs over broad `unsafeApi` object casts and keep any exceptions explicitly inventoried.

## Impact

- Affected code: `packages/convex/convex/{aiAgentActions,outboundMessages,push,widgetSessions}.ts`, `packages/convex/convex/carousels/triggering.ts`, and targeted Convex hardening guard tests.
- Affected systems: Convex internal cross-function calls in AI agent actions, outbound push routing, carousel triggering, widget session verification, and push delivery flows.
- Dependencies: existing localized `TS2589` workarounds, Convex internal function refs, and package-level Convex verification commands.
