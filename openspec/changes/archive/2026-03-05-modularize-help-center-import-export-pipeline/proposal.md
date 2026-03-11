## Why

`packages/convex/convex/helpCenterImports.ts` currently combines path normalization, markdown/frontmatter parsing, asset rewrite rules, folder sync orchestration, and export packaging in a 1993-line file. The current shape slows change velocity in a correctness-sensitive import/export pipeline.

## What Changes

- Split Help Center import/export logic into focused modules for parsing, path/reference normalization, asset mapping, import orchestration, and export orchestration.
- Preserve existing sync and export behavior for markdown files, asset reference rewriting, and history/source tracking.
- Centralize shared path and rewrite helpers so import and export flows reuse the same deterministic rules.
- Add parity tests for markdown sync and export portability behavior.

## Capabilities

### New Capabilities

- `help-center-import-export-modularity`: Help Center markdown import/export is implemented through explicit modules with shared deterministic rewrite rules.

### Modified Capabilities

- None.

## Impact

- Convex backend internals: `packages/convex/convex/helpCenterImports.ts` and related helpers.
- Help Center sync and export test coverage.
- Contributor workflow for import/export changes through smaller, domain-scoped modules.
