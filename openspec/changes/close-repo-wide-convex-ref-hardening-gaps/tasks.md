## 1. Scope Lock And Batch Verification Matrix

- [ ] 1.1 Record the full remaining-gap inventory in this change (Convex backend, web, widget, sdk-core, react-native-sdk, and remaining test matcher duplication files) so migration scope is explicit and finite.
- [ ] 1.2 Define batch-level verification commands per package (`@opencom/convex`, `@opencom/web`, `@opencom/widget`, `@opencom/sdk-core`, `@opencom/react-native-sdk`) including targeted tests for each touched slice.
- [ ] 1.3 Confirm and document any approved temporary exceptions for intentionally opaque Convex return payloads before implementation starts.

## 2. Hardening Remaining Convex Backend Boundaries

- [ ] 2.1 Replace remaining `getInternalRef(name: string)` / `getApiRef(name: string)` helpers in uncovered Convex modules (including notifications, messaging, conversation, visitor, article/content, campaign, auth/event, and series scheduler paths) with fixed typed refs or typed adapters.
- [ ] 2.2 Remove remaining broad unknown ref return signatures in covered Convex notification/runtime boundaries where payload/result shapes are known.
- [ ] 2.3 Run `pnpm --filter @opencom/convex typecheck` and targeted Convex tests for touched modules before moving to frontend/SDK batches.

## 3. Hardening Remaining Web And Widget Source Boundaries

- [ ] 3.1 Migrate remaining web pages/components with `makeFunctionReference<..., any|unknown, ...>` (campaigns, outbound, settings, articles, checklists, inbox, messenger settings, and tooltips helper patterns) to explicit typed refs or local typed wrappers.
- [ ] 3.2 Migrate remaining widget runtime files using broad `Record<string, unknown>`/`unknown` Convex ref signatures to explicit typed boundaries.
- [ ] 3.3 Replace remaining duplicated dot-vs-colon function-path test matching in widget and web test files with shared canonical matcher utilities.
- [ ] 3.4 Run `pnpm --filter @opencom/web typecheck`, `pnpm --filter @opencom/widget typecheck`, and focused web/widget tests for all touched domains.

## 4. Hardening Remaining SDK-Core And React-Native-SDK Boundaries

- [ ] 4.1 Replace generic `getQueryRef/getMutationRef/getActionRef(name: string)` patterns across `packages/sdk-core/src/api/**` with fixed typed refs or typed boundary modules.
- [ ] 4.2 Replace equivalent generic ref-factory patterns across `packages/react-native-sdk/src/hooks/**`, `src/components/**`, and `src/push/**` with explicit typed boundaries.
- [ ] 4.3 Run `pnpm --filter @opencom/sdk-core typecheck`, `pnpm --filter @opencom/sdk-core test`, `pnpm --filter @opencom/react-native-sdk typecheck`, and targeted react-native-sdk tests for touched modules.

## 5. Guardrails, Final Validation, And Handoff

- [ ] 5.1 Add or expand package-local hardening guard tests/checks to prevent reintroduction of generic string ref factories, broad `any|unknown` Convex ref signatures, and duplicated ref-name matcher logic in covered paths.
- [ ] 5.2 Run a final full-scope grep/guard scan to verify no remaining gaps persist in covered files from the inventory.
- [ ] 5.3 Run `openspec validate close-repo-wide-convex-ref-hardening-gaps --strict --no-interactive` and mark all tasks complete once verification is green.
