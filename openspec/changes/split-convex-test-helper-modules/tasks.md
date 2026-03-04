## 1. Domain Module Structure

- [ ] 1.1 Define helper/fixture domain boundaries and create target module layout.
- [ ] 1.2 Add compatibility barrel entry points for incremental migration.

## 2. Extraction

- [ ] 2.1 Move helper utilities into domain-focused modules.
- [ ] 2.2 Move seed/test data blocks into domain-focused modules.
- [ ] 2.3 Update key tests to consume domain module imports.

## 3. Validation

- [ ] 3.1 Run Convex test suites that depend on migrated helpers.
- [ ] 3.2 Verify deterministic fixture behavior in migrated domains.

## 4. Cleanup

- [ ] 4.1 Remove obsolete monolithic helper/data files once migration is complete.
- [ ] 4.2 Document fixture ownership conventions for future contributions.
