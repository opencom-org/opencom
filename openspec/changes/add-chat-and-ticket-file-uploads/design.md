## Context

Opencom already has multiple Convex storage patterns:

- `packages/convex/convex/articles.ts` uses `ctx.storage.generateUploadUrl()` plus a metadata finalization step for article assets.
- `packages/convex/convex/messengerSettingsCore.ts` uses the same storage primitives for messenger logos.
- Email ingestion persists inbound attachment metadata on `messages.emailMetadata.attachments`.

What is missing is a reusable attachment flow for product-authored chat and ticket interactions. Today:

- `packages/convex/convex/messages.ts` only accepts text content for visitor and agent chat messages.
- `packages/convex/convex/tickets.ts` only accepts text fields for ticket creation and ticket comments.
- Widget chat, widget ticket creation/detail, inbox reply, and web ticket detail are all text-only surfaces.

This change crosses shared backend data modeling, widget upload UX, inbox/ticket admin UX, and authorization rules for both visitors and agents. The main constraints are secure access, bounded storage growth, and reuse of existing Convex upload/finalize patterns instead of inventing an unrelated file pipeline.

## Goals / Non-Goals

**Goals:**

- Allow authorized participants to attach supported files to chat messages.
- Allow supported files on ticket submission and ticket comments.
- Reuse Convex storage primitives and shared validation/finalization logic where possible.
- Return a consistent attachment descriptor shape with fresh download URLs to authorized readers.
- Track attachment metadata and staged-upload lifecycle so abandoned uploads can be cleaned up safely.

**Non-Goals:**

- Replacing existing inbound email attachment ingestion/storage behavior in this change.
- Adding public, never-expiring CDN URLs for support attachments.
- Adding rich inline media editing, annotations, or binary preview generation pipelines.
- Allowing arbitrary cross-conversation or cross-ticket attachment reuse.

## Decisions

### 1) Add a dedicated `supportAttachments` metadata table and lightweight parent references

Decision:

- Introduce a new `supportAttachments` table for chat and ticket uploads.
- Core fields should include `workspaceId`, `storageId`, `fileName`, `mimeType`, `size`, `status`, `messageId?`, `ticketId?`, `ticketCommentId?`, `uploadedByType`, `uploadedById?`, `createdAt`, `attachedAt?`, and `expiresAt?`.
- Parent records (`messages`, `tickets`, `ticketComments`) should store attachment ID arrays so read paths can batch-load only relevant attachments.

Rationale:

- Inline attachment blobs or large inline metadata arrays would make message/ticket records harder to evolve and harder to clean up.
- A shared table gives one lifecycle model for both chat and ticket uploads without overloading the existing `articleAssets` table, which has article-specific semantics.

Alternatives considered:

- Store attachment metadata inline on `messages`, `tickets`, and `ticketComments`: rejected because it complicates cleanup, validation reuse, and future reporting.
- Create separate attachment tables per surface: rejected because chat and tickets need the same storage/auth lifecycle.

### 2) Reuse the existing Convex two-step upload pattern, but stage uploads before binding them to parent records

Decision:

- Reuse `ctx.storage.generateUploadUrl()`, `ctx.storage.getMetadata()`, and `ctx.storage.getUrl()` as the underlying storage primitives.
- Add shared attachment mutations for generating upload URLs and finalizing uploaded files into staged attachment records.
- `messages.send`, `tickets.create`, and `tickets.addComment` should accept staged attachment IDs and atomically bind them to the new parent record once authorization succeeds.

Rationale:

- This mirrors the existing article asset flow closely enough to avoid another ad hoc upload model.
- Staging attachments before send/submit gives the product a way to clean up abandoned uploads instead of leaking unattached storage files.

Alternatives considered:

- Pass raw `storageId` values directly into message/ticket mutations: rejected because it increases orphan risk and duplicates validation logic at every call site.
- Reuse `articleAssets` directly: rejected because support attachments have different ownership, access, and retention rules.

### 3) Attachment access should inherit parent chat/ticket permissions and resolve signed URLs at read time

Decision:

- Attachment download and metadata access should always be authorized through the parent conversation or ticket access checks.
- Message and ticket queries should return a normalized attachment descriptor that includes metadata and a fresh signed download URL for each authorized attachment.
- UI surfaces should consume the same descriptor shape for widget, inbox, and ticket detail rendering.

Rationale:

- Parent-scoped auth is simpler and less error-prone than introducing a second ACL model for attachments.
- Resolving signed URLs at read time keeps storage URLs short-lived and prevents the need for public attachment links.

Alternatives considered:

- Expose standalone attachment APIs with separate tokens: rejected because it adds access complexity without clear benefit.
- Persist long-lived storage URLs on attachment records: rejected because it weakens security and creates stale URL issues.

### 4) Model ticket-submission attachments on the ticket record, and reply attachments on ticket comments

Decision:

- Files attached during ticket creation should bind directly to the ticket record.
- Files attached during ongoing discussion should bind to individual `ticketComments`.
- Ticket detail queries should return both ticket-level attachments and per-comment attachments so UI can render them in the correct context.

Rationale:

- Ticket creation already persists a first-class `description` on the ticket itself, so a synthetic initial comment is unnecessary.
- Keeping reply attachments on comments preserves timeline fidelity for later discussion.

Alternatives considered:

- Convert every ticket submission into an auto-generated first comment: rejected because it adds migration and rendering churn to an existing model that already distinguishes ticket root data from comments.

### 5) Start with a constrained file policy and explicit stale-upload cleanup

Decision:

- Enforce a server-side allowlist and size/count limits for support attachments, optimized for common support artifacts such as images, PDFs, and plain-text diagnostics.
- Non-renderable files should fall back to download links rather than bespoke preview generation.
- Staged attachments that are not attached before their expiry window should be deleted from both metadata and Convex storage by cleanup logic.

Rationale:

- A constrained allowlist keeps the first release safe and operationally predictable.
- Cleanup is required because upload occurs before final send/submit, and abandoned drafts are inevitable.

Alternatives considered:

- Allow any browser-uploadable file type: rejected because it increases security and abuse risk.
- Skip stale cleanup and accept storage leaks: rejected because it creates unbounded orphan growth.

## Risks / Trade-offs

- [Risk] Staged uploads increase temporary storage churn.
  -> Mitigation: enforce short expiry windows and delete stale staged attachments automatically.

- [Risk] Attachment joins can make message/ticket reads heavier.
  -> Mitigation: batch-load only referenced attachment IDs for the requested conversation or ticket page.

- [Risk] Visitor and agent auth paths can drift across widget and web surfaces.
  -> Mitigation: centralize parent-resource access checks in shared backend helpers and add focused auth regression tests.

- [Risk] Some supported files will not preview cleanly in every surface.
  -> Mitigation: normalize to download-first rendering, with inline previews only for safe/browser-native cases.

## Migration Plan

1. Add `supportAttachments` schema, indexes, and shared validators/types.
2. Implement shared upload URL, attachment finalization, URL resolution, and stale-cleanup helpers on the Convex side.
3. Extend `messages`, `tickets`, and `ticketComments` to reference attachment IDs and resolve normalized attachment descriptors in read APIs.
4. Update widget chat/ticket flows and web inbox/ticket flows to upload, attach, render, and download files.
5. Add focused tests for auth, validation, cleanup, and cross-surface rendering.
6. Run strict OpenSpec validation before implementation handoff.

Rollback strategy:

- Hide attachment upload UI and stop accepting new attachment bindings.
- Leave already stored attachment records additive and non-destructive so rollback does not corrupt existing chat/ticket content.
- If needed, disable stale-cleanup scheduling while retaining storage records for manual inspection.

## Open Questions

- What exact default allowlist and size/count limits should ship for v1?
- Should outbound email reply composition converge on the same attachment model in this change, or remain separate from chat/ticket uploads for now?
- Do we need malware scanning before general availability, or is strict allowlist plus download-first rendering sufficient for the first release?
