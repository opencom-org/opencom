## Why

The archived `introduce-widget-local-convex-wrapper-hooks` change covered the first widget hotspot slice, but a March 11, 2026 repo scan still found direct `convex/react` usage across widget shell, session, overlay, tracking, and ticket-flow modules. These are mostly consistency gaps rather than current typecheck failures, but they still leave runtime and orchestration files owning transport details directly. The widget-local adapter in `apps/widget/src/lib/convex/hooks.ts` also still relies on localized `as never` / `as unknown as` boundaries; that boundary is acceptable today, but it remains the main stricter follow-on if we want the widget surface fully covered by the same hardening pass.

## What Changes

- Expand widget-local wrapper coverage to the remaining runtime, shell, session, overlay, and tracking modules identified in the March 11, 2026 scan.
- Move direct `convex/react` imports and inline `makeFunctionReference(...)` declarations out of covered widget runtime/UI modules into widget-owned wrappers or feature-local typed ref helpers.
- Tighten `apps/widget/src/lib/convex/hooks.ts` so the adapter keeps the smallest practical cast surface and any unavoidable escape hatches stay explicit.
- Extend widget hardening guards so only the approved adapter, bootstrap, and test boundaries keep direct Convex hook imports.
- Preserve existing visitor-visible widget behavior, boot/session semantics, and overlay flow contracts while coverage expands.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `widget-local-convex-wrapper-hooks`: Expand the archived widget pilot coverage to the remaining direct-import runtime, shell, and overlay modules discovered by the March 11, 2026 scan.

## Impact

- Affected code: remaining direct-import files under `apps/widget/src/**`, `apps/widget/src/lib/convex/hooks.ts`, plus the widget hardening guard and targeted widget tests.
- Affected systems: widget shell orchestration, session lifecycle, overlay flows, tracking hooks, and local ref-hardening verification.
- Dependencies: existing `apps/widget/src/lib/convex/hooks.ts` adapter boundary and the archived widget wrapper-hook pattern already used in earlier domains.
