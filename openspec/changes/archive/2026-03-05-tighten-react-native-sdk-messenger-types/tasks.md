## 1. Contract Definition

- [x] 1.1 Define canonical messenger composition prop interfaces in a shared type module.
- [x] 1.2 Identify and document current cast-based prop mismatch points.

## 2. Migration

- [x] 2.1 Update `OpencomMessenger` to consume canonical prop contracts.
- [x] 2.2 Update `MessengerContent` and related composers to pass typed props without broad casts.
- [x] 2.3 Add typed adapter mapping where compatibility transforms are required.

## 3. Verification

- [x] 3.1 Run RN SDK typecheck and targeted tests for composed messenger flows.
- [x] 3.2 Add guardrails/tests to prevent reintroduction of broad cast escapes.

## 4. Cleanup

- [x] 4.1 Remove obsolete local prop interfaces replaced by canonical contracts.
- [x] 4.2 Document ownership and extension rules for messenger composition types.
