## Why

`packages/react-native-sdk/src/components/MessengerContent.tsx` currently passes key props into `OpencomMessenger` using `as any`, masking contract mismatches in core message view composition. These escapes reduce confidence during RN SDK refactors.

## What Changes

- Replace `as any` messenger composition paths with explicit, shared prop interfaces.
- Tighten composed messenger view contracts across `MessengerContent`, `OpencomMessenger`, and related wrappers.
- Add compile-time and runtime parity checks to ensure behavior remains unchanged.
- Document type ownership and extension points for messenger composition props.

## Capabilities

### New Capabilities

- `rn-sdk-messenger-type-contracts`: RN SDK messenger composition uses explicit typed prop contracts without broad cast escapes.

### Modified Capabilities

- None.

## Impact

- RN SDK components and shared prop types around `MessengerContent` and `OpencomMessenger`.
- RN SDK typecheck and targeted component tests.
- Improved refactor safety for messenger composition.
