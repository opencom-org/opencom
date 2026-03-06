## 1. Shared Contract

- [x] 1.1 Add audience-rule contract types to `@opencom/types`.
- [x] 1.2 Export new audience-rule contracts from `packages/types/src/index.ts`.

## 2. Web Adoption

- [x] 2.1 Refactor `AudienceRuleBuilder` to use shared contracts and backend-compatible segment reference shape.
- [x] 2.2 Refactor `apps/web/src/lib/audienceRules.ts` to align conversion helpers with shared contracts.
- [x] 2.3 Update outbound targeting flow to inline-only rule state (no segment references).
- [x] 2.4 Fix article markdown export union narrowing in `apps/web/src/app/articles/page.tsx`.

## 3. Verification

- [x] 3.1 Add/extend web tests for audience-rule helper conversions.
- [x] 3.2 Run targeted checks (`@opencom/types` typecheck, `@opencom/web` test/typecheck, `@opencom/widget` typecheck) and fix regressions.

## 4. Documentation

- [x] 4.1 Add progress notes for this refactor slice and update remaining-refactor roadmap with newly confirmed priorities.
