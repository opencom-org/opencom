## Why

The mobile conversation composer currently keeps unsent text only in screen-local state. If an operator starts typing, switches apps, or the conversation screen is remounted, the draft is lost and the reply has to be rewritten.

## What Changes

- Persist unsent mobile conversation drafts locally so operators can resume unfinished replies after app switching, background/foreground transitions, and conversation screen remounts.
- Scope drafts to the signed-in operator, active workspace/backend, and conversation so one draft does not bleed into another account or thread.
- Clear the persisted draft after a successful send while preserving the current retry behavior when send fails.
- Add coverage for draft restore, overwrite, and clear-on-send behavior in the mobile app implementation.

## Capabilities

### New Capabilities
- `mobile-message-draft-persistence`: Mobile inbox conversation composers retain unsent drafts across temporary app exits and conversation screen reloads.

### Modified Capabilities
- None.

## Impact

- `apps/mobile/app/(app)/conversation/[id].tsx` composer state and lifecycle handling.
- Mobile-local persistence utilities built on existing AsyncStorage usage.
- Mobile app verification for background/resume and send/clear draft flows.
