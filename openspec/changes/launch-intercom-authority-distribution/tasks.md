## 1. Distribution Playbook And Templates

- [ ] 1.1 Create `docs/seo/` playbook documenting target tiers, qualification criteria, and owner handoffs for directory/listicle outreach.
- [ ] 1.2 Create reusable outreach templates for directory submissions and editorial outreach.
- [ ] 1.3 Create an evidence pack section with approved claim snippets and required links (license, deployment, comparison, migration).

## 2. Authority Tracker And Refresh Workflow

- [ ] 2.1 Add a machine-readable tracker artifact for target URL, owner, status, next action date, and notes.
- [ ] 2.2 Define status transition rules (`not-started`, `submitted`, `in-review`, `live`, `rejected`) in playbook docs.
- [ ] 2.3 Add refresh cadence rules and ensure alternatives/comparison assets have review-date fields.

## 3. Mentions Proof Surface

- [ ] 3.1 Add structured mentions data model with source URL, publication name, verification flag, and timestamps.
- [ ] 3.2 Implement `/mentions/` landing route that renders only verified entries and displays last updated timestamp.
- [ ] 3.3 Add links from `/mentions/` to `/intercom-alternative/`, `/compare/intercom/`, and onboarding/docs CTAs.

## 4. Program Measurement And Reporting

- [ ] 4.1 Define reporting template covering impressions, clicks, CTR, and at least one conversion-aligned metric.
- [ ] 4.2 Document weekly operating cadence for tracker updates, outreach follow-ups, and KPI review.
- [ ] 4.3 Seed tracker with an initial target set and baseline status snapshot.

## 5. Verification

- [ ] 5.1 Validate docs/template completeness against spec requirements.
- [ ] 5.2 Validate mentions page rendering and internal links.
- [ ] 5.3 Run landing package quality checks (typecheck/lint/tests as available) for any app changes.
