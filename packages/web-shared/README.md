# @opencom/web-shared

Shared browser-focused utilities for `apps/web` and `apps/widget`.

## Markdown Utility Ownership

- Source of truth for markdown rendering and sanitization lives in `src/markdown.ts`.
- Web and widget must use this package instead of maintaining local parser/sanitizer copies.
- Shared behavior covered here:
  - markdown-it parser configuration
  - frontmatter stripping
  - DOMPurify allowlist and style-forbid policy
  - protocol hardening for links and images
  - plain-text excerpt helper

## Extension Rules

- Keep one canonical sanitization policy in this package.
- Surface-specific behavior must be explicit options passed to `parseMarkdown`:
  - `linkTarget`
  - `linkRel`
- Do not fork parser/sanitizer logic in `apps/web` or `apps/widget`.
- If a surface needs new behavior, add an option + shared tests in this package first.

## Notification Cue Core Ownership

- Source of truth for unread cue algorithms lives in `src/notificationCues.ts`.
- Shared behavior covered here:
  - unread snapshot construction
  - unread increase detection
  - focus/visibility suppression predicate
  - preference adapter contract for storage/default behavior

## Notification Cue Extension Rules

- Keep unread math and suppression predicates in `@opencom/web-shared`.
- Surface differences must stay in adapters only:
  - storage keys
  - default preference values
  - missing-field behavior for legacy payloads
- Do not re-implement snapshot/increase/suppression loops in app-level cue files.
- Add shared invariant tests in this package before changing cue logic.
