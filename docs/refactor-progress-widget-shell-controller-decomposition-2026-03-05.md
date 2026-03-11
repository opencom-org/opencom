# Refactor Progress: Widget Shell Controller Decomposition (2026-03-05)

## Scope

- `apps/widget/src/Widget.tsx`
- `apps/widget/src/widgetShell/types.ts`
- `apps/widget/src/widgetShell/helpers.ts`
- `apps/widget/src/widgetShell/WidgetMainShell.tsx`
- `openspec/changes/decompose-widget-shell-controller/*`

## Problem Addressed

`Widget.tsx` concentrated shell types/helpers, header-tab resolution, and large tabbed-shell render logic in one controller file.

## What Was Refactored

1. Extracted shell domain types (`WidgetView`, `WidgetProps`, ticket form value/data types).
2. Extracted pure shell helpers:
   - ticket form normalization
   - active tab resolution
   - tab header metadata resolution
3. Extracted tabbed shell render frame into `WidgetMainShell`:
   - shell header + actions
   - tab content frame
   - bottom navigation + unread/tour badges
4. Recomposed `Widget.tsx` to keep orchestration/hooks/mutations local while delegating shell frame rendering.

## Result

- `apps/widget/src/Widget.tsx` reduced to 1285 lines (from ~1427).
- Existing widget shell behavior is preserved while controller/view boundaries are clearer.
- `Widget` external props and integration behavior remain unchanged.

## Compatibility Notes (Web / Widget / Mobile / SDKs)

- No shared contract changes across `@opencom/types`, Convex API, mobile SDK, or RN SDK.
- This slice is widget-shell-local decomposition with web typecheck compatibility validation.

## Verification

Passed:

- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/widget test -- --run src/test/widgetShellOrchestration.test.tsx`
- `pnpm --filter @opencom/widget test -- --run src/test/widgetTourStart.test.tsx`
- `pnpm --filter @opencom/web typecheck`
