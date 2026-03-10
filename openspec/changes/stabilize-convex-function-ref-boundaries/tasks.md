## 1. Baseline And Pilot Contracts

- [ ] 1.1 Inventory the current broad ref-boundary patterns in `packages/convex`, `apps/web`, and widget tests, and lock the first backend/web/widget pilot domains.
- [ ] 1.2 Define the approved adapter, wrapper, and test-helper placement conventions for covered domains.
- [ ] 1.3 Record the mandatory verification commands for each migration slice before implementation expands.

## 2. Backend Pilot Hardening

- [ ] 2.1 Replace the generic string-based scheduler/internal ref helper in one small Convex module with fixed typed boundaries and validate `pnpm --filter @opencom/convex typecheck`.
- [ ] 2.2 Apply the same validated pattern to one representative `runQuery` or `runAction` Convex module and run targeted Convex tests plus package typecheck.
- [ ] 2.3 Add targeted backend guardrails for covered modules so broad string-ref helpers do not return after the pilot is proven.

## 3. Web And Widget Pilot Boundaries

- [ ] 3.1 Migrate the settings/workspace-members web domain to the approved local wrapper boundary and validate `pnpm --filter @opencom/web typecheck` plus focused tests.
- [ ] 3.2 Migrate one additional web domain with current page-level `any`/`unknown` refs to the same pattern and rerun targeted verification.
- [ ] 3.3 Add a shared widget test ref-name helper based on supported Convex APIs and migrate the current duplicated test helpers in session/conversation flows.

## 4. Expansion And Validation

- [ ] 4.1 Expand backend and frontend adoption in small batches only after the previous batch passes package typecheck and targeted tests.
- [ ] 4.2 Add migration guidance or lightweight guardrails so new code follows the approved boundary pattern in covered domains.
- [ ] 4.3 Run `openspec validate stabilize-convex-function-ref-boundaries --strict --no-interactive`.
