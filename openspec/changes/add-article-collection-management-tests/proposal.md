## Why

Collection management is now the primary article taxonomy, but the old knowledge-folder tests were removed with the `/knowledge` refactor and there is no direct automated coverage for `/articles/collections`. That leaves collection create/edit/delete and hierarchy guardrails exposed to silent regressions even though they now carry the organizational responsibilities that folders used to cover.

## What Changes

- Add deterministic automated coverage for the articles collection-management surface, including route entry, empty-collection CRUD, and hierarchy safety behavior.
- Add stable automation hooks or accessible labels to collection-management controls where the current UI only exposes icon buttons or brittle DOM structure.
- Add focused lower-level coverage for collection guardrail notices that are driven by local UI logic and do not need full cross-surface setup to verify.
- Update test docs and verification steps so collection-management coverage is treated as part of the articles admin regression surface.

## Capabilities

### New Capabilities
- `web-article-collection-management-coverage`: Keep deterministic automated coverage for collection-management entry, CRUD flows, and hierarchy/deletion guardrails in the articles admin surface.

### Modified Capabilities
- None.

## Impact

- Web app: `apps/web/src/app/articles/collections/page.tsx`, related local helpers, and the `/articles` entry point that links into collection management.
- Tests: new or expanded Playwright coverage for collection-management flows, plus focused web tests for guardrail helpers or notices.
- Test maintenance: selectors, labels, and skip-registry/docs updates needed to keep collection coverage stable after the knowledge-folder removal.
