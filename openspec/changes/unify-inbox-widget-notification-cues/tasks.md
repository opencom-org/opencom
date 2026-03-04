## 1. Shared Core Extraction

- [ ] 1.1 Create shared pure cue utilities for unread snapshots, increases, and suppression predicates.
- [ ] 1.2 Define adapter contracts for surface-specific preference persistence and defaults.

## 2. Surface Integration

- [ ] 2.1 Refactor web inbox cue utility to consume shared core functions.
- [ ] 2.2 Refactor widget cue utility to consume shared core functions.
- [ ] 2.3 Preserve current surface storage keys and default preference behavior.

## 3. Verification

- [ ] 3.1 Add shared test vectors for unread increase and suppression invariants.
- [ ] 3.2 Run targeted web/widget tests that cover cue-triggered behavior.

## 4. Cleanup

- [ ] 4.1 Remove duplicated core cue logic from surface-local files.
- [ ] 4.2 Document shared cue-core ownership and extension guidance.
