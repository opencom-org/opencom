## Why

Unread notification-cue logic is implemented separately in `apps/web/src/lib/inboxNotificationCues.ts` and `apps/widget/src/lib/widgetNotificationCues.ts` with overlapping behavior and small divergences. This increases drift risk for suppression rules and unread increase detection across surfaces.

## What Changes

- Introduce a shared notification-cue core utility that both web inbox and widget consume.
- Standardize unread snapshot/increase calculations and suppression decision contracts.
- Preserve intentional surface defaults (for example preference defaults and storage keys) via explicit configuration.
- Add cross-surface tests to verify shared cue behavior and suppression invariants.

## Capabilities

### New Capabilities

- `cross-surface-notification-cues`: Web inbox and widget consume shared notification-cue logic with explicit surface configuration.

### Modified Capabilities

- None.

## Impact

- Web and widget cue utility modules and their call sites.
- Tests for unread increase detection and suppression behavior.
- Reduced behavior drift and duplicated maintenance.
