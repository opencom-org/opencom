## Why

The current hardening change proved the approach in targeted pilots, but repo-wide gaps remain across backend, web, widget, SDK core, and React Native SDK surfaces. At the same time, several older package-specific OpenSpec changes already own large parts of that work, so the next proposal needs to close the remaining gaps without creating duplicate ownership or oversized migration batches.

## What Changes

- Freeze the full remaining-gap inventory and assign each file cluster to a single owning change or an explicit accepted exception.
- Keep the older package-specific proposals as the owners for unfinished web, widget, and React Native SDK wrapper-boundary work where the current codebase still matches their scope.
- Treat `fix-sdk-core-convex-type-surface` as a tactical predecessor: verify/archive it if the implemented code satisfies its narrower stability scope, and open only a small follow-on delta if residual sdk-core hardening beyond that scope is still desired.
- Document the repo rule that generated `api.*` / `internal.*` refs remain preferred, localized `makeFunctionReference("module:function")` is an acceptable escape hatch only for verified `TS2589` hotspots, and generic `name: string` ref factories are not the default end state.
- Record `packages/convex/convex/testAdmin.ts` as the only accepted dynamic exception in the residual backend set, with explicit guardrails that keep it scoped to secret-protected test-only modules.
- Use this change to coordinate residual backend Convex cleanup that is not already owned elsewhere, plus shared anti-regression guardrails and verification/closeout rules.
- Keep rollout validation-first with micro-batches small enough to rerun package typecheck and focused tests before widening scope.

## Capabilities

### New Capabilities
- `cross-surface-convex-ref-boundary-hardening`: Covers ownership mapping, residual backend Convex boundary cleanup, and shared anti-regression guardrails across related hardening changes.

### Modified Capabilities
- `runtime-type-safety-hardening`: Extend existing runtime hardening requirements from pilot coverage to repo-wide Convex boundary patterns and guardrails.

## Impact

- Affected code: residual uncovered files in `packages/convex/convex/**`, shared guard/scan helpers and test utilities, and the task/spec artifacts for the older owning changes that still cover `apps/web`, `apps/widget`, `packages/sdk-core`, and `packages/react-native-sdk`.
- Affected systems: Convex runtime cross-function calls, package-level verification flows, and guardrails that prevent broad ref-boundary regressions.
- Dependencies: `stabilize-convex-function-ref-boundaries`, `introduce-web-local-convex-wrapper-hooks`, `introduce-widget-local-convex-wrapper-hooks`, `refactor-react-native-sdk-hook-boundaries`, and `fix-sdk-core-convex-type-surface`.
