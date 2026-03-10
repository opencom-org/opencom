## Why

The current type-hardening work fixed immediate `TS2589` failures, but it also spread broad `makeFunctionReference(...)`, `any`/`unknown`, and ad hoc function-path handling across Convex runtime modules, web pages, and widget tests. We need a validation-first migration plan that keeps typecheck green while converging on stronger, repeatable type boundaries instead of normalizing stringly typed refs as the long-term default.

## What Changes

- Define a validation-first rollout for Convex ref hardening so each migration slice proves package typecheck and targeted tests before broader adoption.
- Standardize backend dynamic Convex calls on explicit typed adapter boundaries with fixed function refs, instead of generic `name: string` ref helpers in feature modules.
- Standardize web and widget surfaces on local wrapper layers or feature-local typed ref modules so UI/runtime files do not recreate Convex signatures inline.
- Replace brittle test-only Convex ref introspection with a shared helper built on supported Convex function-name extraction.
- Add guardrails and migration rules so new type-hardening work preserves contract safety while still avoiding deep-instantiation failures.

## Capabilities

### New Capabilities

- `convex-function-ref-boundaries`: Covers validated, explicit Convex ref boundaries across backend runtime modules, app-local wrapper layers, and test helpers.

### Modified Capabilities

- None.

## Impact

- Affected code: `packages/convex/convex/**`, `apps/web/src/**`, `apps/widget/src/**`, and targeted tests/helpers around Convex hook mocks.
- Affected systems: Convex runtime scheduling/internal invocation paths, web and widget data-access boundaries, and TypeScript verification flows.
- Dependencies: existing wrapper-hook changes in `apps/web` and `apps/widget`, current Convex runtime adapter patterns, and package-level typecheck/test commands used as rollout gates.
