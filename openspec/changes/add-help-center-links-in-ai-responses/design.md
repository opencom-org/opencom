## Context

AI source attribution exists, but actionable source navigation is missing in key UX paths. Visitors see source titles but cannot click through to relevant articles directly from AI responses.

## Goals / Non-Goals

**Goals:**
- Provide clickable source links for article-backed AI responses.
- Keep source attribution structured and consistent across widget and AI review surfaces.
- Handle mixed source types gracefully.

**Non-Goals:**
- Redesigning full help center UI navigation.
- Changing AI retrieval/ranking logic in this change.

## Decisions

### 1) Enrich source metadata with linkable article identity

Decision:
- Include link-ready metadata for article sources (for example article ID and navigable target) in stored AI response payloads.

Rationale:
- Rendering layers need explicit data to build reliable links.

Alternatives considered:
- Infer links from title text in UI. Rejected due to ambiguity and fragility.

### 2) Render source chips/links in widget message context

Decision:
- Widget AI message component renders source links as clickable UI elements that route to article detail.

Rationale:
- Improves self-service resolution directly inside conversation flow.

Alternatives considered:
- Keep plain text only. Rejected due to poor UX and traceability.

### 3) Keep fallback handling for non-article sources

Decision:
- Non-linkable sources remain labeled attribution entries without broken link affordances.

Rationale:
- Maintains source transparency without invalid navigation.

## Risks / Trade-offs

- [Risk] Link targets could become stale if article records are removed.
  - Mitigation: resolve targets at render time and fallback to title-only entry when unavailable.
- [Risk] Extra metadata may increase payload size.
  - Mitigation: keep source payload minimal and structured.

## Migration Plan

1. Extend source metadata schema and response serialization for linkable article fields.
2. Update widget AI source rendering to show clickable article entries.
3. Update AI review/chat source renderers to use linkable metadata.
4. Add tests for link rendering and non-article fallback behavior.

Rollback:
- Revert UI link rendering while preserving source metadata extension for future use.

## Open Questions

- Should source links include deep links for web inbox contexts in this same change?
- Do we show per-source confidence/rank in UI now or later?
