## Context

Two near-duplicate markdown utilities currently evolve independently. Small divergence already exists in helper exports and parser setup. Because markdown rendering includes sanitization policy, drift can become a security and UX risk.

## Goals / Non-Goals

**Goals:**
- Define one shared markdown rendering/sanitization implementation.
- Preserve existing allowed tags/attributes and safe-link behavior.
- Support optional helpers (for example plain-text excerpts) through the same shared module.
- Add tests that lock down parity and sanitization outcomes.

**Non-Goals:**
- Replacing markdown-it or DOMPurify in this change.
- Redesigning widget/web message UI.
- Introducing markdown extensions beyond current behavior.

## Decisions

### 1) Shared utility module with option-driven surface differences

Decision:
- Create a shared utility (in workspace package space) and expose one primary `parseMarkdown` plus helper exports.
- Surface-specific behavior differences must be explicit options rather than duplicated code branches.

Rationale:
- Central source of truth with controlled extension points.

Alternatives considered:
- Keep two files and synchronize manually. Rejected due to ongoing drift risk.

### 2) Single sanitization policy and link-hardening pass

Decision:
- Define one allowlist and protocol policy consumed by both web and widget.

Rationale:
- Security-sensitive logic should not diverge by accident.

Alternatives considered:
- Separate per-surface allowlists. Rejected for maintenance complexity.

### 3) Snapshot-style parity tests for representative markdown inputs

Decision:
- Add shared test vectors covering links, images, frontmatter, and unsafe HTML.

Rationale:
- Prevents regressions and undocumented drift.

Alternatives considered:
- Manual spot checks only. Rejected as insufficient for security-sensitive code.

## Risks / Trade-offs

- [Risk] Hidden reliance on old utility quirks in one surface.
  - Mitigation: run parity tests and allow explicit opt-in options where necessary.
- [Risk] Shared module changes could impact both surfaces at once.
  - Mitigation: version utility changes behind tests and focused review ownership.

## Migration Plan

1. Create shared markdown utility with current common behavior.
2. Migrate web utility to consume shared module.
3. Migrate widget utility to consume shared module and keep only surface-specific wrappers.
4. Add parity and sanitization regression tests.
5. Remove duplicated logic and run typecheck/tests.

Rollback:
- Re-point surface import paths to previous local implementations if parity fails.

## Open Questions

- Should the shared utility live in `packages/sdk-core` or a dedicated markdown package?
- Do we need separate renderer presets for help-center pages versus chat bubbles now or later?
