## 1. Domain Module Structure

- [x] 1.1 Define helper/fixture domain boundaries and create target module layout.
- [x] 1.2 Add compatibility barrel entry points for incremental migration.

## 2. Extraction

- [x] 2.1 Move helper utilities into domain-focused modules.
- [x] 2.2 Move seed/test data blocks into domain-focused modules.
- [x] 2.3 Update key tests to consume domain module imports.

## 3. Validation

- [x] 3.1 Run Convex test suites that depend on migrated helpers.
- [x] 3.2 Verify deterministic fixture behavior in migrated domains.

## 4. Cleanup

- [x] 4.1 Remove obsolete monolithic helper/data files once migration is complete.
- [x] 4.2 Document fixture ownership conventions for future contributions.
