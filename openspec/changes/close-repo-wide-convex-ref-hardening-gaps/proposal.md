## Why

The current hardening change proved the approach in targeted pilots, but repo-wide gaps remain across backend, web, widget, SDK core, and React Native SDK surfaces. Those gaps still rely on generic string ref factories and broad `any`/`unknown` Convex ref typing, so type safety is inconsistent and regressions can re-enter outside pilot domains.

## What Changes

- Expand Convex ref hardening from pilot domains to all remaining source files that still use generic `get*Ref(name: string)` / `getInternalRef(name: string)` / `getApiRef(name: string)` helper patterns.
- Replace remaining source-level `makeFunctionReference<..., any|unknown, ...>` and `Record<string, unknown>` hot spots with fixed typed refs or typed boundary adapters per domain.
- Migrate remaining widget test suites with duplicated local `getFunctionPath` extraction and dot-vs-colon comparisons to shared normalized helpers.
- Add cross-package guardrails to prevent reintroduction of broad ref factories and untyped Convex refs in covered domains.
- Keep rollout validation-first: typecheck and focused test gates must pass for each migration batch before widening scope.

## Capabilities

### New Capabilities
- `cross-surface-convex-ref-boundary-hardening`: Enforces explicit, typed Convex function-reference boundaries and shared ref-name normalization across Convex backend modules, web/widget runtimes, SDK packages, and their tests.

### Modified Capabilities
- `runtime-type-safety-hardening`: Extend existing runtime hardening requirements from pilot coverage to repo-wide Convex boundary patterns and guardrails.

## Impact

- Affected code: `packages/convex/convex/**`, `apps/web/src/**`, `apps/widget/src/**`, `packages/sdk-core/src/**`, `packages/react-native-sdk/src/**`, and related tests/guards.
- Affected systems: Convex runtime cross-function calls, web/widget data access boundaries, SDK API wrappers, and test harnesses that match Convex function refs.
- Dependencies: existing pilot artifacts in `stabilize-convex-function-ref-boundaries`, current wrapper-hook changes, and package verification commands (`pnpm --filter <pkg> typecheck` + targeted tests).
