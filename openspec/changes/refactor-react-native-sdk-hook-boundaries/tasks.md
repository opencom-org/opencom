## 1. Foundation

- [ ] 1.1 Define internal SDK boundaries for generated Convex hook access, visitor/session/config resolution, and public hook ergonomics.
- [ ] 1.2 Add reusable internal helpers/adapters for transport and gating behavior where repeated patterns exist.
- [ ] 1.3 Ensure unavoidable casts or generated type escape hatches are centralized in internal SDK helper boundaries.

## 2. Initial domain migrations

- [ ] 2.1 Refactor conversations and tickets hooks onto the new internal boundary pattern.
- [ ] 2.2 Refactor home configuration, article, and messenger settings hooks/components onto the new pattern.
- [ ] 2.3 Update exported components/controllers that currently duplicate transport logic inline.

## 3. Compatibility verification

- [ ] 3.1 Confirm public SDK hooks preserve existing return semantics and side-effect behavior for consuming apps.
- [ ] 3.2 Add or update targeted SDK tests for refactored domains.
- [ ] 3.3 Run relevant SDK typecheck/test commands for touched code.
- [ ] 3.4 Run `openspec validate refactor-react-native-sdk-hook-boundaries --strict --no-interactive`.
