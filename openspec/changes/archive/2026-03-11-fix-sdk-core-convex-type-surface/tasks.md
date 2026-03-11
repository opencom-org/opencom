## 1. Implementation

- [x] 1.1 Identify the remaining `sdk-core` API wrapper modules that trigger `TS2589` during dependent package builds or typechecks.
- [x] 1.2 Apply localized typed `makeFunctionReference(...)` query/mutation helpers at each pathological Convex wrapper call site.
- [x] 1.3 Keep wrapper signatures and runtime behavior unchanged while stabilizing the type surface.
- [x] 1.4 Review `sdk-core` package exports and entrypoints for any avoidable amplification of unrelated type traversal.

## 2. Verification

- [x] 2.1 Run `pnpm --filter @opencom/sdk-core typecheck` if/when available for the touched package surface.
- [x] 2.2 Run dependent consumer verification, including `pnpm --filter @opencom/web build`.
- [x] 2.3 Run any relevant SDK package verification affected by touched wrappers.
- [x] 2.4 Run `openspec validate fix-sdk-core-convex-type-surface --strict --no-interactive`.
