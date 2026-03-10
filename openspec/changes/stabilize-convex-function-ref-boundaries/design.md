## Context

This branch proved that replacing generated Convex refs with `makeFunctionReference(...)` can unblock `TS2589` in both `packages/convex` and `apps/web`. It also showed the failure mode of doing that too broadly: backend modules now use `getInternalRef(name: string): unknown` helpers, several web routes recreate function signatures inline with `any`/`unknown`, and widget tests inspect private runtime object structure to recover function names.

The repo already points to the right long-term direction in two places:

- the archived `tighten-runtime-types-without-any` change, which introduced typed runtime adapters for dynamic Convex calls in high-risk backend modules
- the active `introduce-web-local-convex-wrapper-hooks` and `introduce-widget-local-convex-wrapper-hooks` changes, which move Convex transport details out of UI/runtime files and into app-local wrapper layers

This change coordinates those patterns into a single migration plan with hard verification gates so the team can improve contract safety without triggering another wave of type explosions.

## Goals / Non-Goals

**Goals:**

- Keep `@opencom/convex` and `@opencom/web` typecheck green while converging on stronger Convex ref boundaries.
- Prove the preferred boundary pattern in small pilot slices before migrating more modules.
- Standardize backend dynamic Convex invocation on typed adapters with fixed refs rather than generic string ref factories.
- Standardize web and widget usage on local wrappers or feature-local typed ref modules instead of page/runtime-local ad hoc casts.
- Replace private Convex ref inspection in tests with a shared helper built on supported public APIs.

**Non-Goals:**

- Reverting every `makeFunctionReference(...)` usage back to generated refs in one pass.
- Redesigning backend business logic, permissions, or generated Convex output.
- Migrating mobile in this change unless a touched helper or convention needs to be shared there later.
- Enforcing a repo-wide ban on dynamic escape hatches before the validated replacement pattern exists.

## Decisions

### 1) Roll out through validation-first pilot slices

Decision:

- Use small pilot migrations with explicit verification gates before expanding the pattern.
- Treat each slice as incomplete until package typecheck and targeted tests pass for the touched surface.

Rationale:

- The current branch demonstrates that broad ref substitutions can hide contract regressions even when typecheck passes.
- Tight feedback loops are the safest way to avoid another large-scale type regression cleanup.

Alternatives considered:

- Repo-wide ref rollback or mass conversion. Rejected because it is too likely to reintroduce deep-instantiation failures without clear stopping points.
- Leaving the current broad string-ref pattern in place. Rejected because it weakens contract safety too much to be a stable default.

### 2) Backend dynamic boundaries use typed adapters with fixed refs

Decision:

- Keep the shallow `ctx.runQuery` / `ctx.runAction` / `ctx.runMutation` / `ctx.scheduler.runAfter` cast only at dedicated adapter boundaries.
- Pair those shallow runners with fixed typed function ref constants or domain adapter functions, not feature-level helpers that accept arbitrary `name: string`.

Rationale:

- The shallow runner cast solves the deep-instantiation problem at the actual hot spot.
- Fixed refs and adapter functions preserve far more path/args/return safety than generic string-based helpers.

Alternatives considered:

- Continue using `getInternalRef(name: string)` or `getApiRef(name: string)` throughout feature modules. Rejected because it removes compile-time checking for function identity and payload shape.
- Restore direct generated refs everywhere. Rejected because some runtime paths are already known `TS2589` hotspots.

### 3) Web and widget surfaces own local wrapper boundaries

Decision:

- Move web and widget Convex interactions behind app-local wrappers or feature-local typed ref modules.
- UI/runtime files should consume those local wrappers instead of declaring their own `FunctionReference` casts or `makeFunctionReference<..., any, ...>` instances inline.

Rationale:

- This matches the active OpenSpec wrapper-hook changes already in flight.
- It reduces repetition, keeps transport logic discoverable, and limits the blast radius of any necessary escape hatch.

Alternatives considered:

- Keep page-level typed refs as the normal pattern. Rejected because it duplicates contracts and spreads type-boundary decisions across too many files.
- Build one generic wrapper factory for all surfaces. Rejected because it tends to become opaque and can reintroduce inference pressure in a different form.

### 4) Tests normalize refs via supported Convex APIs

Decision:

- Introduce a shared helper for tests that extracts function names via Convex's public `getFunctionName(...)`, with string passthrough for lightweight mocks.

Rationale:

- Current widget tests probe symbols and private object structure, which is brittle and duplicates logic across files.
- A shared helper gives consistent colon/dot normalization while staying on a supported API surface.

Alternatives considered:

- Leave each test file to inspect ref objects ad hoc. Rejected because it is fragile and already duplicated.

### 5) Guardrails ratchet only after the pilot pattern is proven

Decision:

- Add targeted guardrails after the first backend and frontend pilot slices are stable.
- Scope guards to covered modules/domains first, then expand with the migration.

Rationale:

- Enforcing a broad rule before the replacement pattern is proven would slow delivery and encourage one-off bypasses.

Alternatives considered:

- Add repo-wide bans on `any`, `unknown`, or `makeFunctionReference(name)` immediately. Rejected because current modules still rely on these escapes and need a safe migration path first.

## Risks / Trade-offs

- [Risk] Pilot slices may surface additional hidden `TS2589` hotspots once one module is cleaned up.
  - Mitigation: sequence work in narrow batches and rerun package typecheck after each batch before moving on.
- [Risk] Fixed ref constants still require some manual typing and can drift from backend contracts.
  - Mitigation: keep them centralized per domain, favor narrow adapters over repeated inline declarations, and verify with targeted tests plus package typecheck.
- [Risk] Mixed patterns will temporarily coexist during rollout.
  - Mitigation: define covered domains explicitly and ratchet guards only where the new pattern is already in place.
- [Risk] Wrapper layers can become overly abstract.
  - Mitigation: prefer explicit domain wrappers and feature-local ref modules over a single generic abstraction.

## Migration Plan

1. Capture the approved boundary rules and verification gates in this change.
2. Pilot the backend scheduler pattern in one small Convex module that currently uses generic internal ref helpers and validate `pnpm --filter @opencom/convex typecheck` plus targeted tests.
3. Pilot the backend `runQuery` / `runAction` pattern in one representative module after the scheduler slice is stable, again validating Convex package checks before expanding.
4. Pilot the web wrapper pattern in the settings/workspace-members flow that already aligns with the active web wrapper-hook change, and validate `pnpm --filter @opencom/web typecheck` plus focused tests.
5. Replace duplicated widget test ref-name logic with the shared helper and validate targeted widget tests.
6. Expand domain-by-domain only after each prior slice is stable, then add targeted guardrails to prevent backsliding in covered modules.

Rollback:

- Stop after any failed slice and revert only that slice, leaving already-proven adapters or helper layers intact for reuse.

## Open Questions

- Which backend module should be the first `runQuery` / `runAction` pilot: a smaller scheduler-oriented file such as `tickets.ts` or a richer aggregator such as `suggestions.ts`?
- Should shared typed ref constants live inside each domain module, in adjacent `refs.ts` files, or in app-local wrapper modules only?
- Do we want a small generated shallow-ref layer later, or is explicit handwritten domain ownership the preferred steady state?
