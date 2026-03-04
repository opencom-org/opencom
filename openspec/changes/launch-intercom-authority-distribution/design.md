## Context

Competitive query rankings for "Intercom alternatives" are dominated by established domains with strong backlink profiles. Even after on-site intent pages launch, Opencom needs an operational distribution loop to gain third-party mentions, maintain freshness, and prove authority over time.

This change spans process artifacts in `docs/`, structured tracking data, and a lightweight landing proof surface (`/mentions/`) that supports both trust and crawlable internal linking.

## Goals / Non-Goals

**Goals:**
- Define an execution-ready playbook for directory submissions and editorial outreach.
- Standardize outreach assets so claims remain consistent and source-backed.
- Track outreach lifecycle and refresh cadence in machine-readable artifacts.
- Publish a crawlable mentions surface that consolidates earned proof.
- Define measurable SEO checkpoints for iteration.

**Non-Goals:**
- Automating third-party submissions end-to-end.
- Building a full CRM/revenue attribution platform.
- Guaranteeing placements from external publishers.

## Decisions

### 1) Store authority operations as versioned docs + machine-readable tracker

Decision:
- Add human-readable playbook/template docs and a tracker artifact (CSV or JSON) under `docs/seo/`.

Rationale:
- Versioned repo artifacts provide auditability, collaboration, and compatibility with simple scripts/reporting.

Alternatives considered:
- Tracking only in ad-hoc spreadsheets: rejected due to poor reviewability and weak change history.

### 2) Define a minimum outreach asset pack with evidence constraints

Decision:
- Standardize required outreach snippets: positioning paragraph, differentiators, license/deployment facts, and links to comparison/migration pages.

Rationale:
- Outreach consistency prevents contradictory claims and accelerates submission throughput.

Alternatives considered:
- Free-form outreach copy per contributor: rejected due to quality variance.

### 3) Build `/mentions/` from structured mention entries

Decision:
- Represent mentions as structured entries with source URL, publication name, verification state, and timestamp; render from this data source.

Rationale:
- Structured entries make verification explicit and support deterministic UI rendering plus freshness metadata.

Alternatives considered:
- Hardcoded mentions in JSX: rejected because it does not scale and is error-prone during updates.

### 4) Use periodic refresh checkpoints tied to intent pages

Decision:
- Add review cadence requirements for alternatives/comparison pages and tie them to tracker entries with next-action dates.

Rationale:
- Competitive pages degrade without recurring updates; tracking dates enforces ongoing maintenance.

Alternatives considered:
- One-time launch without refresh SLA: rejected due to expected ranking decay.

### 5) Keep measurement intentionally lightweight at first

Decision:
- Start with a compact KPI set (impressions, clicks, CTR for target queries + one conversion-aligned metric) and refine later.

Rationale:
- Keeps the program operable immediately without waiting for a complex analytics stack.

Alternatives considered:
- Full multi-touch attribution before launch: rejected as too slow for immediate ranking work.

## Risks / Trade-offs

- [Risk] Outreach tracker becomes stale and loses trust.
  - Mitigation: enforce owner and next-action fields with status transitions.
- [Risk] Public mentions page lists unverified or low-quality references.
  - Mitigation: include verification state and only render verified entries.
- [Risk] Overly aggressive claims in outreach damage credibility.
  - Mitigation: require source-backed claims and explicit available-now vs roadmap labels.

## Migration Plan

1. Add `docs/seo/` playbook, outreach templates, and authority tracker artifact.
2. Add structured mention data model and implement `/mentions/` route.
3. Add nav/footer links to mentions page where appropriate.
4. Backfill initial targets and mention entries from existing known placements.
5. Start weekly authority update loop and log KPI snapshots.

Rollback:
- Keep docs/tracker artifacts intact and hide `/mentions/` route if needed.
- Re-enable route after data cleanup without losing process documentation.

## Open Questions

- Which team role owns weekly tracker updates after initial launch?
- Should rejected outreach targets remain visible in the same tracker file or be archived separately?
- Do we need a strict minimum domain-quality threshold for mentions before display?
