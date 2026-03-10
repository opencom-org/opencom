## Context

The current change `stabilize-convex-function-ref-boundaries` validated the hardening pattern in pilot slices, but a full-repo scan shows the same anti-patterns still present outside those pilots:

- broad string-based Convex ref factories (`get*Ref(name: string)`, `getInternalRef(name: string)`, `getApiRef(name: string)`) across Convex backend modules, SDK packages, and web tooling pages
- source-level `makeFunctionReference<..., any|unknown, ...>` in remaining web and widget runtime domains
- duplicated test-local function-path extraction/matching logic in remaining widget suites

This change extends the validated boundary pattern to all remaining source surfaces while preserving the same validation-first rollout model. It must coordinate backend (`packages/convex`), web/widget runtimes (`apps/web`, `apps/widget`), SDK wrappers (`packages/sdk-core`), and React Native SDK surfaces (`packages/react-native-sdk`) so boundary quality is consistent and enforceable.

## Goals / Non-Goals

**Goals:**

- Eliminate remaining generic string ref factories in covered source files by replacing them with fixed typed refs or typed boundary adapters.
- Eliminate remaining source-level `makeFunctionReference<..., any|unknown, ...>` hot spots in covered domains.
- Standardize widget test ref matching on shared helpers with Convex-supported function-name extraction.
- Add repo guardrails for covered domains so these broad patterns do not re-enter after migration.
- Preserve package typecheck and behavior by shipping in verification-gated batches.

**Non-Goals:**

- Rewriting business logic, permissions, or UX behavior unrelated to type boundaries.
- Enforcing an immediate repo-wide ban in untouched domains that are not covered by this change.
- Converting every Convex call site to generated `api`/`internal` refs where known `TS2589` hotspots still require local escape hatches.
- Performing release-process changes for SDK packages beyond type-boundary hardening in source.

## Decisions

### 1) Scope closure is package-batch based, not domain-pilot based

Decision:

- Expand from pilot domains to a finite list of remaining files grouped by package (`convex`, `web`, `widget`, `sdk-core`, `react-native-sdk`).
- Treat each package batch as complete only after package typecheck and targeted tests pass.

Rationale:

- The remaining gaps are now distributed across multiple packages, so domain-by-domain sequencing is slower and harder to track.
- Package-batch gating keeps failure isolation while reducing repeated cross-package churn.

Alternatives considered:

- One-shot repo-wide replacement. Rejected due high risk of multi-package type explosion.
- Continue pilot-only coverage. Rejected because it leaves known unsafe boundary patterns in active code paths.

### 2) Source modules use explicit typed ref constants or typed adapters only

Decision:

- Replace generic `name: string` ref helper functions with fixed typed function refs or typed adapter functions per domain.
- Keep shallow Convex runner casts localized to dedicated adapters where needed for `TS2589` escape hatches.

Rationale:

- Fixed refs retain function-path and payload guarantees.
- Localized adapters preserve deep-instantiation mitigation without normalizing untyped dynamic lookup.

Alternatives considered:

- Retain generic `get*Ref(name: string)` helpers with stronger comments. Rejected because contract safety is still bypassed.
- Revert to generated refs everywhere immediately. Rejected because known pathological sites may regress to `TS2589`.

### 3) Test ref matching converges on shared canonical helper

Decision:

- Migrate remaining widget tests to shared `matchesFunctionPath`/`getFunctionPath` helper built on `getFunctionName(...)` with canonical dot/colon normalization.

Rationale:

- Reduces duplication and removes private-shape probing as the primary path for function-name detection.
- Keeps mixed mock styles stable while hardening toward public APIs.

Alternatives considered:

- Leave per-test extraction logic in place. Rejected because it is brittle and duplicated.

### 4) Guardrails are package-local and explicit

Decision:

- Add lightweight guard tests/checks in each covered package to block reintroduction of:
  - generic string ref factory functions in covered paths
  - source-level `makeFunctionReference<..., any|unknown, ...>` in covered paths
  - duplicated function-path helpers in covered widget tests
- Keep guard scope explicit to covered directories and files to avoid premature global blocking.

Rationale:

- Package-local guards are actionable and produce clear remediation paths.
- Explicit scope prevents noisy failures in unrelated untouched domains.

Alternatives considered:

- Single global regex gate. Rejected due poor signal and high false positives.

### 5) Verification matrix is mandatory per batch

Decision:

- Each batch SHALL run:
  - touched package typecheck
  - focused tests for touched files/domains
- Final phase SHALL run strict OpenSpec validation for this change.

Rationale:

- Prevents migration drift and catches hidden follow-on errors early.

Alternatives considered:

- Rely only on workspace-wide checks at the end. Rejected because blast radius is too large for fast rollback.

## Risks / Trade-offs

- [Risk] Broad replacement can trigger new `TS2589` sites once intermediate casts are removed.
  - Mitigation: apply and verify in package batches; keep localized shallow adapter escape hatches where needed.
- [Risk] Handwritten ref argument/return types can drift from backend implementation.
  - Mitigation: co-locate typed refs with domain wrappers, keep test coverage focused on call contracts, and run package typecheck after each batch.
- [Risk] Guardrails may block legitimate edge cases with intentionally opaque payloads.
  - Mitigation: define narrow allowlists and document exceptions in the guard source.
- [Risk] Multi-package scope increases coordination overhead.
  - Mitigation: sequence batches, keep strict completion gates, and avoid parallel in-flight rewrites across packages.

## Migration Plan

1. Freeze and commit the remaining-gap inventory by package from the full-repo scan.
2. Migrate remaining `packages/convex` generic ref factories to typed adapters/fixed refs and validate `pnpm --filter @opencom/convex typecheck` plus targeted Convex tests.
3. Migrate remaining web source hot spots (`apps/web`) away from `any|unknown` and generic ref helper patterns; validate `pnpm --filter @opencom/web typecheck` plus targeted tests.
4. Migrate remaining widget runtime and tests (`apps/widget`) to explicit refs and shared ref helper; validate `pnpm --filter @opencom/widget typecheck` plus targeted tests.
5. Migrate `packages/sdk-core` API modules and `packages/react-native-sdk` hooks/components off generic ref factories; validate package typechecks and relevant targeted tests.
6. Add/expand package-local hardening guard tests for covered paths.
7. Run final verification sweep and `openspec validate close-repo-wide-convex-ref-hardening-gaps --strict --no-interactive`.

Rollback:

- Revert only the failing package batch; keep previously validated batches intact.

## Open Questions

- Which minimal exception list (if any) should remain for intentionally opaque Convex return types in notification scheduling paths?
- Should SDK packages share a generated typed-ref catalog, or keep explicit handwritten refs per module as the steady state?
- Do we want a follow-up change to consolidate package-local guard logic into shared tooling after this scope closes?
