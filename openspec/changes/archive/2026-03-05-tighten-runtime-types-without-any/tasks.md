## 1. Type Boundary Audit

- [x] 1.1 Confirm and document targeted runtime-critical cast/unknown hotspots.
- [x] 1.2 Define typed adapter contracts for dynamic internal invocations.

## 2. Runtime Module Hardening

- [x] 2.1 Migrate `events` and `series` dynamic internal calls to typed adapters.
- [x] 2.2 Tighten `authWrappers` generic contracts where broad casts are currently required.
- [x] 2.3 Narrow high-impact shared `unknown` fields in `packages/types` consumed by runtime-critical logic.

## 3. Guardrails And Validation

- [x] 3.1 Add targeted guard(s) to prevent broad cast regressions in covered modules.
- [x] 3.2 Run Convex typecheck/tests and resolve runtime/type regressions.

## 4. Documentation

- [x] 4.1 Document approved dynamic escape hatches and rationale.
- [x] 4.2 Record migration notes for future type hardening work.
