## 1. Shared Utility Introduction

- [ ] 1.1 Create a shared markdown utility module with parser, sanitization, and helper exports.
- [ ] 1.2 Define explicit options for any intentional per-surface rendering differences.

## 2. Surface Migration

- [ ] 2.1 Migrate web markdown parser imports to the shared utility.
- [ ] 2.2 Migrate widget markdown parser imports to the shared utility.
- [ ] 2.3 Remove duplicated parser/sanitizer code from surface-local files.

## 3. Verification

- [ ] 3.1 Add shared parity tests for representative markdown and sanitization vectors.
- [ ] 3.2 Run targeted web/widget typecheck and tests for markdown-consuming paths.

## 4. Cleanup

- [ ] 4.1 Document ownership of the shared markdown utility and extension rules.
- [ ] 4.2 Confirm no remaining duplicate markdown sanitizer implementations in app code.
