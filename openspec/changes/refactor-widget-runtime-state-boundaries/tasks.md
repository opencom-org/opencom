## 1. Implementation

- [ ] 1.1 Define clearer widget runtime ownership boundaries for navigation/view state, capability resolution, and side effects.
- [ ] 1.2 Reduce broad state responsibility in central widget runtime modules such as `WidgetContext`.
- [ ] 1.3 Extract or reorganize runtime helpers/hooks so widget behavior is easier to localize and test.
- [ ] 1.4 Preserve existing widget routing, tab visibility, and runtime behavior during the refactor.

## 2. Verification

- [ ] 2.1 Run targeted widget tests for touched runtime/navigation flows.
- [ ] 2.2 Run relevant widget package typechecks/tests.
- [ ] 2.3 Run `openspec validate refactor-widget-runtime-state-boundaries --strict --no-interactive`.
