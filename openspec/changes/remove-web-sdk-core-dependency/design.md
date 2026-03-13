## Overview

This change removes the direct dependency from `apps/web` to `@opencom/sdk-core` by isolating web-safe shared selector utilities from SDK runtime client wrappers. The goal is to keep current web behavior intact while preventing unrelated SDK runtime type failures from blocking web verification.

## Goals

- Remove direct `@opencom/sdk-core` imports from `apps/web`.
- Preserve tooltip and tour editor selector-quality behavior in web.
- Ensure web-safe selector utilities can be consumed without traversing SDK runtime API wrappers.
- Reduce build-time coupling between the web app and native/client SDK runtime modules.

## Non-Goals

- Redesigning selector scoring behavior.
- Changing mobile or SDK runtime product behavior.
- Refactoring all `sdk-core` APIs as part of this boundary-only change.

## Architecture

### Web-safe selector utility boundary

- Identify selector-scoring logic that is pure and safe to share with web.
- Move that logic into a dedicated shared module or package that does not import Convex runtime clients or SDK session/API wrappers.
- Update web consumers to import from the new shared boundary instead of `@opencom/sdk-core`.

### Dependency graph reduction

- Remove `@opencom/sdk-core` from `apps/web` dependencies once no web imports remain.
- Ensure the replacement shared utility boundary exports only the functions and types needed by web editor surfaces.
- Avoid root exports that pull unrelated SDK runtime modules into the web typecheck/build graph.

## Risks and Mitigations

- Risk: selector-scoring behavior diverges during extraction.
  - Mitigation: preserve current function signatures and add focused verification around current web call sites.
- Risk: web still indirectly reaches SDK runtime modules through a broad shared package entrypoint.
  - Mitigation: use a narrow export surface or dedicated package entrypoint for the extracted utilities.
- Risk: multiple consumers depend on the current `sdk-core` selector utility path.
  - Mitigation: update all known imports together and keep the utility API stable.

## Rollout Notes

- Start with extracting or narrowing the selector utility boundary.
- Migrate web imports and package dependencies.
- Verify that web typecheck/build no longer traverses `sdk-core` runtime wrappers.
