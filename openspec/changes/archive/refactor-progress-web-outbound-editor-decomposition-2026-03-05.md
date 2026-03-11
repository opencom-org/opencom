# Refactor Progress: Web Outbound Editor Decomposition (2026-03-05)

## Slice

- `decompose-web-outbound-editor` (P0, started)

## Why

`apps/web/src/app/outbound/[id]/page.tsx` mixed UI rendering with outbound contract/state normalization logic.
This pass extracts core click-action/post-button business logic into a dedicated module so state orchestration is shared and easier to test/evolve without touching render branches.

## What Changed In This Pass

1. Added a dedicated outbound editor state/contracts module:
   - `apps/web/src/app/outbound/[id]/editorState.ts`
   - Extracted:
     - shared editor type aliases (`MessageContent`, `MessageButton`, etc.)
     - click-action form state + conversion functions
     - post-button form state + conversion functions
2. Updated outbound editor page to consume extracted business logic:
   - `apps/web/src/app/outbound/[id]/page.tsx`
   - Replaced ad-hoc click-action/post-button initialization/build logic with:
     - `toClickActionFormState`
     - `toMessageClickAction`
     - `toPostButtonFormState`
     - `toPostButtons`
   - Consolidated many primitive `useState` fields into two structured form-state objects.
3. Preserved behavior while reducing page-level decision logic and mutation payload assembly complexity.

## Verification Run Notes

Executed in this pass:

- `pnpm --filter @opencom/web typecheck` -> pass
- `pnpm --filter @opencom/widget typecheck` -> pass
- `pnpm --filter @opencom/convex typecheck` -> pass
- `pnpm --filter @opencom/convex test` -> pass (32 files, 216 tests)
- `pnpm test:compat:cross-surface` -> pass
- Focused outbound E2E:
  - `pnpm web:test:e2e -- apps/web/e2e/outbound.spec.ts --project=chromium`
  - pass with `35 passed`, `1 flaky`, `0 unexpected`
  - flaky case: initial auth-refresh/login probe in first outbound test; retry passed

## Notes

- A Convex generated-type depth edge was surfaced in cross-package typechecks and handled with bounded casting comments in:
  - `packages/convex/convex/outboundMessages.ts`
  - `apps/web/src/app/outbound/[id]/page.tsx`
- This preserves runtime behavior while keeping workspace typechecks stable during ongoing refactor slices.
