## Context

`apps/landing` currently includes a homepage plus broad informational pages (`/features`, `/docs`, etc.) but no dedicated route cluster for high-intent Intercom-alternative queries. Metadata utilities exist (`createLandingPageMetadata`) and can be extended, but there is no route-specific structured-data pattern for FAQ/breadcrumb output and no explicit SEO cluster linking contract.

This change is cross-cutting across route creation, shared content models, metadata generation, and global navigation/linking.

## Goals / Non-Goals

**Goals:**
- Launch an intent-mapped Intercom SEO cluster with dedicated pages for key query families.
- Add trust/evaluation pages (`/compare/intercom/`, `/migrate-from-intercom/`) with clear next-step CTAs.
- Prevent keyword cannibalization by enforcing one primary query intent per page.
- Standardize metadata and structured data output for the cluster.
- Keep comparison content maintainable via reusable data structures rather than hardcoded JSX fragments.

**Non-Goals:**
- Building a full blog CMS in this change.
- Reworking brand-wide design language outside the targeted routes.
- Claiming complete parity with all competitor capabilities where evidence does not exist.

## Decisions

### 1) Use route-per-intent architecture under `apps/landing/src/app`

Decision:
- Implement dedicated route directories for each query target, including nested routes for `/compare/intercom/`.

Rationale:
- Query intent isolation improves relevance and reduces cannibalization from having one generic page for all intents.

Alternatives considered:
- Single long-form page with hash sections: rejected because it weakens intent targeting and snippet control.

### 2) Introduce a shared Intercom cluster content model

Decision:
- Create shared data/config modules for competitor rows, comparison dimensions, FAQ items, and freshness metadata.

Rationale:
- Shared models reduce drift between `/free-intercom-alternatives/` and `/compare/intercom/` while making periodic refresh work low-friction.

Alternatives considered:
- Hand-author each page in JSX only: rejected due to high maintenance risk and inconsistent claim formatting.

### 3) Enforce evidence-backed comparison status labels

Decision:
- Comparison rows include explicit status labels (`available now`, `roadmap`) and source references derived from internal competitive analysis artifacts.

Rationale:
- The provided competitive analysis includes broad capability coverage and should constrain public claims to defensible statements.

Alternatives considered:
- Marketing-only claim language without source constraints: rejected due to trust and regression risk.

### 4) Add explicit metadata and schema primitives per route

Decision:
- Extend metadata helpers and add JSON-LD helper patterns for FAQ/Breadcrumb output, with strict parity between visible content and schema fields.

Rationale:
- Improves eligibility for rich result enhancements while avoiding schema mismatch issues.

Alternatives considered:
- Schema-free implementation: rejected because it leaves obvious SEO wins on the table.

### 5) Define cluster-level internal linking contract

Decision:
- Require reciprocal linking among core intent pages plus prominent hub links from `/features` and shared nav/footer surfaces where appropriate.

Rationale:
- Internal-link graph clarity is required for crawl depth and conversion path continuity.

Alternatives considered:
- Only contextual in-body links: rejected because links may regress during copy edits.

## Risks / Trade-offs

- [Risk] Page overlap creates keyword cannibalization.
  - Mitigation: enforce intent-to-route mapping and distinct H1/title requirements in specs.
- [Risk] Comparison claims drift from current product capability.
  - Mitigation: centralize data with explicit source/status fields and add refresh timestamp requirements.
- [Risk] Structured data can diverge from visible FAQ text.
  - Mitigation: generate JSON-LD from the same content source used to render visible FAQs.

## Migration Plan

1. Add shared content and metadata/schema helpers for the new cluster.
2. Implement route pages in this order: `/intercom-alternative/`, `/open-source-intercom-alternative/`, `/free-intercom-alternatives/`, `/compare/intercom/`, `/migrate-from-intercom/`.
3. Update `/features`, nav, and footer linking to support cluster traversal.
4. Add sitemap/robots coverage and verify cluster URL discoverability.
5. Run route-level QA for metadata, structured data parity, and internal link integrity.

Rollback:
- Revert cluster routes while retaining shared helper modules if needed.
- Keep legacy pages and navigation paths unchanged if rollback occurs.

## Open Questions

- Should `/open-source-intercom/` be added as a redirect alias to `/open-source-intercom-alternative/` for query coverage, or should we keep one canonical route only?
- Should the free alternatives page include scoring weights, or only qualitative comparison plus trade-offs?
- Do we want page-level analytics event hooks in this change, or defer to the authority-tracking change?
