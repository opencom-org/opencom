## 1. Shared Utility Extraction

- [x] 1.1 Add deterministic numbered visitor-readable-ID utility to `@opencom/types`.
- [x] 1.2 Export the new utility from `packages/types/src/index.ts`.

## 2. Consumer Refactor

- [x] 2.1 Refactor `packages/convex/convex/visitorReadableId.ts` to delegate to shared utility while preserving function signature.
- [x] 2.2 Refactor `apps/web/src/lib/visitorIdentity.ts` numbered fallback path to use shared utility.

## 3. Guardrails

- [x] 3.1 Add/extend web tests for deterministic ID output and visitor label precedence.
- [x] 3.2 Run targeted typecheck/tests for affected packages (`types`, `convex`, `web`, `widget`) and fix regressions.

## 4. Documentation

- [x] 4.1 Add progress notes documenting extraction scope, compatibility, and verification outcomes.
