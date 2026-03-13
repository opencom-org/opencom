## 1. Shared Attachment Domain And Storage Lifecycle

- [x] 1.1 Add `supportAttachments` schema, indexes, and shared validators/types for staged and attached chat/ticket files.
- [x] 1.2 Implement shared Convex upload URL, draft-finalization, signed-URL resolution, and stale-upload cleanup helpers that reuse existing storage validation patterns.
- [x] 1.3 Extend message, ticket, and ticket-comment read contracts to resolve normalized attachment descriptors for authorized viewers.

## 2. Chat Attachment Flows

- [x] 2.1 Update chat send mutations and auth checks to bind staged attachment IDs for both visitor and agent messages.
- [x] 2.2 Add widget conversation upload UX and conversation-thread attachment rendering.
- [x] 2.3 Add inbox reply upload UX and attachment rendering for agent chat workflows.

## 3. Ticket Attachment Flows

- [x] 3.1 Update ticket creation to bind staged attachment IDs to the ticket submission and expose them in ticket detail queries.
- [x] 3.2 Update ticket comment mutations and queries to support attachment binding and retrieval for visitor and agent replies.
- [x] 3.3 Add widget and web ticket attachment UX for upload, rendering, and download.

## 4. Verification

- [x] 4.1 Add Convex tests for upload validation, auth scoping, stale-upload cleanup, and attachment binding across chat and ticket paths.
- [x] 4.2 Add web and widget tests for upload error feedback and attachment rendering in conversation and ticket surfaces.
- [x] 4.3 Run strict `openspec validate add-chat-and-ticket-file-uploads --strict --no-interactive` after the change is implementation-ready.
