## 1. Collection Management Testability

- [ ] 1.1 Add stable automation hooks or accessible labels to the collection-management page for row actions, notices, and modal interactions.
- [ ] 1.2 Add shared test helpers for opening `/articles/collections` and targeting collection rows by unique name.

## 2. Browser Coverage

- [ ] 2.1 Add a dedicated Playwright spec that verifies entry into collection management from `/articles`.
- [ ] 2.2 Add Playwright coverage for creating, editing, and deleting an empty collection.
- [ ] 2.3 Add Playwright coverage for nested parent assignment and validation that self/descendant parent choices are excluded.

## 3. Guardrail Coverage And Verification

- [ ] 3.1 Add focused web tests for collection delete guardrail notices, including child-collection and article-count protection paths.
- [ ] 3.2 Update any E2E docs or skip metadata affected by the new collection-management suite.
- [ ] 3.3 Run targeted Playwright and web verification plus `openspec validate add-article-collection-management-tests --strict --no-interactive`.
