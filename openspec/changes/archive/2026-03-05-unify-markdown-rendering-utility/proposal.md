## Why

Markdown parsing and sanitization logic is duplicated between `apps/web/src/lib/parseMarkdown.ts` and `apps/widget/src/utils/parseMarkdown.ts`, including security-sensitive allowlists and link handling behavior. This duplication increases drift risk and can create inconsistent rendering or sanitization guarantees across surfaces.

## What Changes

- Introduce a shared markdown rendering/sanitization utility module consumed by web and widget.
- Centralize markdown parser configuration, sanitization policy, frontmatter stripping, and helper transforms.
- Keep intentional surface-specific behavior behind explicit options instead of copy-pasted implementations.
- Add parity tests to verify equivalent output and sanitization behavior for shared scenarios.

## Capabilities

### New Capabilities

- `shared-markdown-rendering-sanitization`: Web and widget use a single shared markdown rendering and sanitization contract.

### Modified Capabilities

- None.

## Impact

- Web markdown utility path and widget markdown utility path.
- Shared package/module for markdown rendering behavior.
- Tests covering sanitization and renderer parity across surfaces.
