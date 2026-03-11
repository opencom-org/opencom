## Why

`@opencom/sdk-core` currently exposes Convex client wrapper modules that hit TypeScript deep-instantiation failures at generated Convex refs. These failures block dependent package verification, including the web build, and make the SDK package brittle to maintain.

## What Changes

- Localize Convex generated-ref `TS2589` workarounds across the remaining `sdk-core` API wrapper modules.
- Replace pathological generated `api.*` references with typed local `makeFunctionReference(...)` helpers only at affected call sites.
- Keep `sdk-core` client API behavior unchanged while making its type surface stable under workspace typecheck/build.
- Clarify and narrow any overly broad package entrypoint behavior if required to keep type-safe wrappers maintainable.

## Capabilities

### New Capabilities
- `sdk-core-convex-type-stability`: Covers requirements for keeping `sdk-core` Convex wrapper modules build-safe without broad weakening of types.

### Modified Capabilities
- None.

## Impact

- Affected code: `packages/sdk-core/src/api/**/*.ts`, package entrypoints/exports if needed, and dependent package verification flows.
- Affected systems: TypeScript typecheck/build in consumers of `@opencom/sdk-core`, especially `apps/web` and SDK packages.
- Dependencies: Convex client wrapper references, generated function refs, and monorepo package builds.
