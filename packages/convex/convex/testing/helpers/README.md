# Convex Testing Helper Modules

This directory owns internal test-only helper definitions grouped by domain.

## Ownership

- `series.ts`: Series runtime test hooks and progress fixtures.
- `workspace.ts`: Workspace, users, invitations, membership, and workspace setting fixtures.
- `conversations.ts`: Visitor/conversation/message fixtures and conversation operation helpers.
- `notifications.ts`: Push campaign and notification-recipient fixture helpers.
- `content.ts`: Survey, tooltip session, article/collection/snippet, and tour fixtures.
- `email.ts`: Email config/conversation/message/thread fixtures and webhook simulation.
- `tickets.ts`: Ticket and ticket-form fixtures.
- `ai.ts`: AI response and AI settings fixtures.
- `cleanup.ts`: Workspace and E2E cleanup helpers.

## Compatibility

`../helpers.ts` remains the compatibility entrypoint for `api.testing.helpers.*` while this folder owns module-local helper definitions.
