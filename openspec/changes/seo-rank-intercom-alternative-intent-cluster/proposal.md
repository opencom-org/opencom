## Why

Opencom already positions itself as an open-source Intercom alternative, but it lacks dedicated pages mapped to high-intent search queries (for example, "intercom alternative", "free intercom alternatives", and "open source intercom alternative"). As a result, ranking opportunities are being captured by listicles and directories even when Opencom is a direct fit.

## What Changes

- Add a search-intent landing cluster in `apps/landing` with dedicated routes:
  - `/intercom-alternative/`
  - `/free-intercom-alternatives/`
  - `/open-source-intercom-alternative/`
- Add trust and evaluation routes:
  - `/compare/intercom/` for feature, deployment, pricing model, and governance comparison
  - `/migrate-from-intercom/` for an actionable migration guide and expected rollout timeline
- Upgrade `/features` into a cluster hub by adding prominent internal links to comparison and migration content.
- Add reusable comparison content models so pages are consistent, evidence-backed, and easier to refresh.
- Add metadata and structured data requirements for cluster pages (distinct title/H1 intent targeting, canonical paths, FAQ JSON-LD on eligible pages, breadcrumb schema where helpful).
- Add crawl discoverability requirements (sitemap/robots coverage for all cluster routes).
- Add freshness cues on list/comparison pages (for example "last reviewed") so content can be updated without structural rewrites.

## Capabilities

### New Capabilities
- `intercom-alternative-intent-pages`: Landing app serves dedicated, intent-specific Intercom alternative pages with clear query-to-page mapping and conversion paths.
- `intercom-comparison-and-migration-pages`: Landing app serves deep comparison and migration guidance pages that support evaluation intent and reduce conversion friction.
- `landing-seo-cluster-linking-and-schema`: Landing app enforces canonical metadata, structured data, and internal-link graph rules across the Intercom intent cluster.

### Modified Capabilities
- None.

## Impact

- New and updated landing routes under `apps/landing/src/app/**`.
- Shared metadata/content helpers under `apps/landing/src/lib/**`.
- Navigation/footer/feature-page internal links under `apps/landing/src/components/**`.
- QA scope for route rendering, metadata output, and crawl discoverability.
