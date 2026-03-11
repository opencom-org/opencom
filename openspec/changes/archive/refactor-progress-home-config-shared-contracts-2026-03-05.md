# Refactor Progress: Shared Home Config Contracts (2026-03-05)

## Scope

- `packages/types`
- `packages/convex`
- `apps/web` (settings surface)
- `apps/widget`

## Problem Addressed

`HomeConfig`/`HomeTab` contracts and tab normalization behavior were duplicated across:

- `packages/convex/convex/messengerSettings.ts`
- `apps/web/src/app/settings/HomeSettingsSection.tsx`
- `apps/widget/src/components/Home.tsx`
- `apps/widget/src/hooks/useWidgetTabVisibility.ts`

This increased drift risk for:

- Messages-tab invariants
- default-space fallback behavior
- audience visibility handling
- tab-order normalization

## What Was Centralized

Added shared module:

- `packages/types/src/homeConfig.ts`

Shared exports now include:

- `HomeCardType`, `HomeTabId`, `HomeVisibility`, `HomeDefaultSpace`
- `HomeCard`, `HomeTab`, `HomeConfig`
- `DEFAULT_HOME_TABS`, `getDefaultHomeTabs()`
- `normalizeHomeTabs(...)`
- `normalizeHomeConfig(...)`
- `isVisibleToAudience(...)`
- `resolveDefaultHomeSpace(...)`

And exported from:

- `packages/types/src/index.ts`

## Consumer Refactors

### Convex

- `packages/convex/convex/messengerSettings.ts`
  - Replaced local `isVisibleToAudience`/default-space resolution with shared utilities.
  - Replaced local tab defaults with `getDefaultHomeTabs()`.
  - Replaced local home-config normalization with shared `normalizeHomeConfig(...)`.
- `packages/convex/package.json`
  - Added `@opencom/types` workspace dependency.

### Web

- `apps/web/src/app/settings/HomeSettingsSection.tsx`
  - Replaced local `Home*` contract definitions with shared types from `@opencom/types`.
  - Replaced local tab-normalization/default-tab copies with shared helpers.
  - Preserved UI-level `CARD_TYPES`/`TAB_TYPES` display metadata.

### Widget

- `apps/widget/src/components/Home.tsx`
  - Replaced local `Home*` contract definitions with shared types.
  - Replaced local fallback normalization with shared `normalizeHomeConfig(...)`.
  - Reused shared default tabs via `getDefaultHomeTabs()`.
- `apps/widget/src/hooks/useWidgetTabVisibility.ts`
  - Replaced local tab normalization implementation with shared `normalizeHomeTabs(...)`.
  - Preserved widget-specific `includeOnlyConfiguredIds` behavior for public-tab payloads.

## Compatibility Notes (Mobile / SDK)

- No public API signatures were changed in:
  - `apps/mobile`
  - `packages/sdk-core`
  - `packages/react-native-sdk`
- Guardrail verification still passes for those surfaces (typecheck).

## Verification

Passed:

- `pnpm --filter @opencom/types typecheck`
- `pnpm --filter @opencom/convex typecheck`
- `pnpm --filter @opencom/convex test`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/widget test -- src/test/widgetNewConversation.test.tsx src/test/widgetShellOrchestration.test.tsx src/test/widgetTourBridgeLifecycle.test.tsx src/test/widgetTourStart.test.tsx`
- `pnpm --filter @opencom/sdk-core typecheck`
- `pnpm --filter @opencom/mobile typecheck`
- `pnpm --filter @opencom/react-native-sdk typecheck`

Known pre-existing failures (not introduced by this slice):

- `pnpm --filter @opencom/web typecheck` currently fails in audience-rule and article-page typing paths outside this refactor scope.
- `pnpm --filter @opencom/widget test` full suite has an existing failing test in `src/test/tourOverlay.test.tsx` unrelated to this change.
