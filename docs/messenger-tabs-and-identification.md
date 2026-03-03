# Messenger Tabs and Identification

This document captures the current widget tab-visibility behavior and identity semantics, and records a proposed toggle for stricter audience control.

## Current Behavior (as of March 3, 2026)

### Admin controls

Admins can configure tabs from **Settings > Messenger Home > Messenger Tabs**:

- Tabs: `home`, `messages`, `help`, `tours`, `tasks`, `tickets`
- Controls per tab: `enabled`, `visibleTo` (`all`, `visitors`, `users`)

### Intercom-style invariant

`messages` is always on and visible to everyone:

- Cannot be disabled
- Cannot be restricted to only visitors or only users

This matches the Intercom-style baseline where messaging remains the guaranteed escape hatch.

### Runtime filtering flow

1. Backend filters tabs and home cards by `visibleTo` against `isIdentified`.
2. Widget receives only allowed tabs/cards.
3. If current tab is no longer valid, widget falls back to the first visible tab.
4. If no visible tab is available, widget falls back to `messages`.

## What Counts as an Identified User Today

Current widget logic sets `isIdentified` to `true` when either field exists in widget identity input (`init.user` or `OpencomWidget.identify(...)`):

- `userId`
- `email`

So a visitor with only an email is treated as a "user" for audience filtering.

Example:

```javascript
OpencomWidget.identify({
  email: "person@example.com",
});
```

The call above is enough to match `visibleTo: "users"` tabs/cards.

## Why This Matters

- It removes friction for teams that only pass email.
- It also means "users only" does not always imply cryptographically verified identity.

Identity verification remains separate: trusted verification requires `userId` plus `userHash` (HMAC).

## Proposed Toggle (Not Implemented Yet)

Introduce a workspace-level setting for audience classification:

- `email_or_user_id` (default; current behavior)
- `user_id_only` (strict mode)

Suggested admin label:

- "Treat email-only visitors as identified users"

Behavior by mode:

| Mode               | Email only | User ID only | User ID + hash |
| ------------------ | ---------- | ------------ | -------------- |
| `email_or_user_id` | user       | user         | user           |
| `user_id_only`     | visitor    | user         | user           |

Recommended default:

- Keep `email_or_user_id` for compatibility with existing setups.
- Offer `user_id_only` for teams that want stricter access semantics.
