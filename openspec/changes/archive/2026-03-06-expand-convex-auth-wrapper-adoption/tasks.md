## 1. Wrapper Adoption by Domain

- [x] 1.1 Adopt auth wrappers in `segments.ts` for mutation endpoints with throw-on-unauthorized behavior.
- [x] 1.2 Adopt auth wrappers in `assignmentRules.ts` for mutation endpoints with throw-on-unauthorized behavior.
- [x] 1.3 Adopt auth wrappers in `commonIssueButtons.ts` for mutation endpoints with throw-on-unauthorized behavior.
- [x] 1.4 Adopt auth wrappers in `identityVerification.ts` for eligible throw-on-unauthorized endpoints.
- [x] 1.5 Adopt auth wrappers in `workspaceMembers.ts` where semantics are compatible.
- [x] 1.6 Adopt auth wrappers in `workspaces.ts` where semantics are compatible.

## 2. Compatibility Preservation

- [x] 2.1 Preserve soft-fail read-path behavior (`null`/`[]`/`0`) where currently intentional.
- [x] 2.2 Preserve endpoint names/signatures and workspace permission scopes.

## 3. Verification + Tracking

- [x] 3.1 Run `pnpm --filter @opencom/convex typecheck`.
- [x] 3.2 Run dependent package typechecks (`web`, `widget`, `mobile`, `sdk-core`, `react-native-sdk`).
- [x] 3.3 Update refactor progress docs and remaining-map tracker.
