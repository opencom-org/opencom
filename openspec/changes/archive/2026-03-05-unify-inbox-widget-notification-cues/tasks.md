## 1. Shared Core Extraction

- [x] 1.1 Create shared pure cue utilities for unread snapshots, increases, and suppression predicates.
- [x] 1.2 Define adapter contracts for surface-specific preference persistence and defaults.

## 2. Surface Integration

- [x] 2.1 Refactor web inbox cue utility to consume shared core functions.
- [x] 2.2 Refactor widget cue utility to consume shared core functions.
- [x] 2.3 Preserve current surface storage keys and default preference behavior.

## 3. Verification

- [x] 3.1 Add shared test vectors for unread increase and suppression invariants.
- [x] 3.2 Run targeted web/widget tests that cover cue-triggered behavior.

## 4. Cleanup

- [x] 4.1 Remove duplicated core cue logic from surface-local files.
- [x] 4.2 Document shared cue-core ownership and extension guidance.
