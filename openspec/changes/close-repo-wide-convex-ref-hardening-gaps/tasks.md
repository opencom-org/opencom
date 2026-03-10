## 1. Inventory And Ownership Mapping

- [x] 1.1 Freeze the full remaining-gap inventory from the repo-wide scan and map each file cluster to one owner change or an explicit accepted exception.
- [x] 1.2 Verify actual implementation state of overlapping older changes against current code before changing their task status.
- [x] 1.3 Record which residual backend files and shared guardrails are owned directly by this change after the ownership map is complete.

## 2. Predecessor Verification And Closure

- [x] 2.1 Verify `fix-sdk-core-convex-type-surface` against the current sdk-core implementation, run its remaining verification commands, and update/archive it if its narrower scope is already satisfied.
- [x] 2.2 Decide whether any stronger sdk-core end-state cleanup remains after predecessor verification and document that as either an accepted exception or a separate follow-on delta.
- [x] 2.3 Update the dependent active changes (`introduce-web-local-convex-wrapper-hooks`, `introduce-widget-local-convex-wrapper-hooks`, `refactor-react-native-sdk-hook-boundaries`) if their task lists need to reflect the now-confirmed remaining file inventory.

## 3. Residual Backend Micro-Batches

- [x] 3.1 Migrate the first residual Convex backend file cluster that still uses `getInternalRef(name: string)` / `getApiRef(name: string)` to explicit typed boundaries and run focused verification.
- [ ] 3.2 Continue residual backend cleanup in additional file clusters only after the previous cluster passes `pnpm --filter @opencom/convex typecheck` and targeted tests.
- [ ] 3.3 Confirm residual backend behavior remains unchanged for covered runtime paths after each micro-batch.

## 4. Shared Guardrails And Final Validation

- [ ] 4.1 Add or expand guard tests/checks for covered residual backend files and shared test-helper paths so prohibited broad ref-boundary patterns cannot re-enter.
- [x] 4.2 Run the final repo-wide scan against the frozen inventory to confirm every remaining gap is either closed or explicitly reassigned to its owner change.
- [x] 4.3 Run `openspec validate close-repo-wide-convex-ref-hardening-gaps --strict --no-interactive` and any touched dependent change validations once ownership and residual work are consistent.
