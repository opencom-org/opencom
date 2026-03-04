## 1. Type Boundary Audit

- [ ] 1.1 Confirm and document targeted runtime-critical cast/unknown hotspots.
- [ ] 1.2 Define typed adapter contracts for dynamic internal invocations.

## 2. Runtime Module Hardening

- [ ] 2.1 Migrate `events` and `series` dynamic internal calls to typed adapters.
- [ ] 2.2 Tighten `authWrappers` generic contracts where broad casts are currently required.
- [ ] 2.3 Narrow high-impact shared `unknown` fields in `packages/types` consumed by runtime-critical logic.

## 3. Guardrails And Validation

- [ ] 3.1 Add targeted guard(s) to prevent broad cast regressions in covered modules.
- [ ] 3.2 Run Convex typecheck/tests and resolve runtime/type regressions.

## 4. Documentation

- [ ] 4.1 Document approved dynamic escape hatches and rationale.
- [ ] 4.2 Record migration notes for future type hardening work.
