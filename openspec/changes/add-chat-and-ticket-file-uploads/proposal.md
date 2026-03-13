## Why

Support flows already rely on Convex storage for article images and messenger assets, and inbound email messages can carry attachment metadata, but chat messages and tickets are still text-only unless users paste external links. That makes common support workflows like sharing screenshots, PDFs, and logs brittle, so we need a first-class upload path before more support activity concentrates in widget and inbox surfaces.

## What Changes

- Add file attachment upload/send flows for authorized chat participants in widget and inbox conversations.
- Add file attachment upload/send flows for ticket creation and ticket comments across visitor and agent surfaces.
- Add shared Convex storage-backed upload/finalize APIs and attachment metadata persistence that can be reused across chat and ticket flows instead of copying one-off storage logic per surface.
- Extend chat and ticket read APIs plus UI surfaces to render attachment metadata with secure download URLs for authorized viewers.
- Add validation and lifecycle rules for supported file types, size/count limits, access control, and staged-upload cleanup.

## Capabilities

### New Capabilities

- `chat-and-ticket-file-attachments`: Upload, validate, store, and render file attachments for chat messages, ticket submissions, and ticket comments.

### Modified Capabilities

- None.

## Impact

- Convex schema and support-domain mutations/queries in `messages.ts`, `tickets.ts`, and shared upload helpers.
- Widget chat and ticket compose/detail surfaces.
- Web inbox and ticket detail surfaces for composing, rendering, and downloading attachments.
- Regression coverage for auth, validation, cleanup, and cross-surface attachment rendering.
