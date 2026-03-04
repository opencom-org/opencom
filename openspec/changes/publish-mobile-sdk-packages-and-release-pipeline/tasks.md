## 1. Publishability Planning

- [ ] 1.1 Define publishable SDK package set and dependency resolution strategy.
- [ ] 1.2 Identify and remove/replace workspace-only dependencies in published artifacts.

## 2. Package Metadata Updates

- [ ] 2.1 Update package manifests (`private`, versioning strategy, `publishConfig`, files/exports) for publish-ready packages.
- [ ] 2.2 Ensure transitive dependency versions are registry-resolvable.

## 3. Release Automation

- [ ] 3.1 Implement CI workflow for versioning, build/type/test checks, and publish.
- [ ] 3.2 Add dry-run/smoke-install validation before publish steps.

## 4. Documentation And Validation

- [ ] 4.1 Update mobile SDK install docs and release runbook to match final distribution path.
- [ ] 4.2 Validate installation in a clean consumer project flow.
