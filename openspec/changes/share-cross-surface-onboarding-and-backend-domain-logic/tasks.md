## 1. Implementation

- [ ] 1.1 Identify cross-surface backend/workspace/onboarding rules that should share one domain implementation.
- [ ] 1.2 Extract those rules into an appropriate shared package or module boundary.
- [ ] 1.3 Integrate the shared domain helpers into web and mobile without changing intended UX outcomes.
- [ ] 1.4 Keep surface-specific rendering and navigation concerns local while removing duplicated shared rule logic.

## 2. Verification

- [ ] 2.1 Run targeted web and mobile tests for touched onboarding/backend/workspace flows.
- [ ] 2.2 Run relevant web/mobile/shared package typechecks for touched areas.
- [ ] 2.3 Run `openspec validate share-cross-surface-onboarding-and-backend-domain-logic --strict --no-interactive`.
