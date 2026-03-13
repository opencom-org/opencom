## 1. Stage Boundary Definition

- [x] 1.1 Define module boundaries for parsing, rewrite/normalization, sync apply, and export build stages.
- [x] 1.2 Move shared path/reference helpers into a common internal utility layer.

## 2. Extraction

- [x] 2.1 Extract markdown/frontmatter parsing behavior into dedicated modules with unchanged outputs.
- [x] 2.2 Extract asset reference rewrite and unresolved-reference reporting into dedicated modules.
- [x] 2.3 Extract import apply orchestration and export packaging orchestration into separate modules.

## 3. Parity Coverage

- [x] 3.1 Add fixture-driven tests for import rewrite parity and unresolved reference reporting.
- [x] 3.2 Add tests for export portability and re-import fidelity.

## 4. Cleanup

- [x] 4.1 Remove obsolete monolithic helper branches from `helpCenterImports.ts`.
- [x] 4.2 Document module ownership and expected stage contracts.
