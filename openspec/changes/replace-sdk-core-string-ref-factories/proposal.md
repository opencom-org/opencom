## Why

The archived `fix-sdk-core-convex-type-surface` change stabilized workspace typecheck, but a March 11, 2026 repo scan still found generic `getQueryRef(name: string)` and `getMutationRef(name: string)` factories across the remaining `@opencom/sdk-core` API wrapper modules. Those helpers keep function selection stringly typed, make contract review harder, and are now the largest remaining "accepted but not ideal" Convex ref boundary outside mobile.

## What Changes

- Replace generic string ref factories in covered `packages/sdk-core/src/api/**/*.ts` modules with explicit fixed ref constants or narrow typed ref modules.
- Preserve the archived type-stability outcome by keeping any required `makeFunctionReference("module:function")` escape hatch localized to fixed refs rather than caller-selected `name: string` helpers.
- Preserve public `@opencom/sdk-core` wrapper method behavior, payload semantics, and return contracts.
- Add guardrail verification so covered sdk-core wrapper files do not reintroduce generic string ref factories after the migration.

## Capabilities

### New Capabilities
- `sdk-core-explicit-convex-function-refs`: Covers explicit fixed Convex refs in sdk-core wrapper modules so wrapper files stop selecting targets through generic `name: string` factories.

### Modified Capabilities
- None.

## Impact

- Affected code: `packages/sdk-core/src/api/{aiAgent,articles,carousels,checklists,commonIssues,conversations,events,officeHours,outbound,sessions,tickets,visitors}.ts`
- Affected systems: `@opencom/sdk-core` type boundaries, downstream package typecheck/build traversal, and sdk-core wrapper tests.
- Dependencies: existing `sdk-core-convex-type-stability` behavior remains in force; this is a follow-on hardening pass, not a new runtime contract.
