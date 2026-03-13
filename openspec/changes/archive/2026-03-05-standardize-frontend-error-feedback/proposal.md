## Why

Frontend error handling currently uses raw `alert(...)` calls in high-traffic UI paths (`apps/web/src/app/settings/page.tsx`, `apps/web/src/app/settings/MessengerSettingsSection.tsx`, `apps/widget/src/Widget.tsx`). This creates inconsistent UX and fragmented error handling behavior.

## What Changes

- Introduce shared, non-blocking error feedback patterns for web and widget (toast/inline/banner patterns as appropriate).
- Replace direct `alert(...)` usage in covered frontend paths with standardized feedback utilities/components.
- Normalize error mapping (user message, actionable follow-up, and optional retry) across covered flows.
- Add tests for error rendering behavior in critical settings/widget actions.

## Capabilities

### New Capabilities

- `frontend-error-feedback-standardization`: Covered frontend surfaces use a standardized, non-blocking error feedback contract.

### Modified Capabilities

- None.

## Impact

- Web settings surfaces and widget action flows currently using raw alerts.
- Shared UI error feedback utility/components.
- Frontend tests for standardized error feedback behavior.
