## Overview

This change stabilizes `@opencom/sdk-core` by localizing Convex generated-ref workarounds at the small set of pathological wrapper call sites that trigger `TS2589`. The design keeps the public SDK API intact while replacing deep generated type expansion with explicit typed function references only where necessary.

## Goals

- Eliminate current `TS2589` build failures in `sdk-core` wrapper modules.
- Preserve existing SDK runtime behavior and public function signatures.
- Keep Convex type weakening localized to pathological sites rather than broad package-wide escape hatches.
- Maintain a clear migration pattern for future wrapper modules that hit the same issue.

## Non-Goals

- Redesigning SDK public APIs.
- Refactoring unrelated runtime behavior.
- Converting the entire package to untyped function references.

## Architecture

### Localized Convex wrapper stabilization

- For affected wrapper files, replace generated `api.*` references used in `client.query(...)` or `client.mutation(...)` with local helpers built on `makeFunctionReference(...)`.
- Type those helpers as `FunctionReference<"query">` or `FunctionReference<"mutation">` so they satisfy the client contract without forcing deep generated type expansion.
- Limit the workaround to pathological files and keep existing runtime call arguments unchanged.

### Entry-point and package-surface hygiene

- Review whether broad root exports amplify unrelated type evaluation across consumers.
- If needed, narrow or organize exports so stable wrappers remain easy to consume while avoiding unnecessary traversal of unrelated modules.

## Risks and Mitigations

- Risk: mistyped string refs break runtime calls.
  - Mitigation: keep refs module-local, mirror the existing generated function names exactly, and verify via package builds/typechecks.
- Risk: broad conversion reduces useful type safety.
  - Mitigation: restrict the workaround only to the modules that currently trigger `TS2589`.
- Risk: more hotspots surface after each fix.
  - Mitigation: continue the loop of targeted fixes and rerun package verification after each batch.

## Rollout Notes

- Fix the currently failing `sdk-core` API modules first.
- Rebuild dependent consumers after each batch to uncover the next hotspot.
- Document the localized workaround pattern for future Convex wrapper additions.
