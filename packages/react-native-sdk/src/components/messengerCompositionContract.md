# Messenger Composition Contract (RN SDK)

This contract governs prop wiring between:

- `Opencom.tsx` (public API + modal shell)
- `MessengerContent.tsx` (tab/composition layer)
- `OpencomMessenger.tsx` (messages list/detail runtime)

## Canonical Types

Defined in `messengerCompositionTypes.ts`:

- `MessengerNestedView`
- `MessengerConversationId`
- `MessengerCompositionControlProps`

These are the single source of truth for messenger composition control props.

## Previous Mismatch Points (Removed)

1. `MessengerContent` previously passed `activeConversationId` to `OpencomMessenger` with `as any`.
2. `MessengerContent` previously passed `onConversationChange` using `as any` because a raw state setter (`Dispatch<SetStateAction<...>>`) did not match the callback signature.
3. Public `OpencomRef.presentConversation(conversationId: string)` uses string IDs while messenger internals use Convex `Id<"conversations">`.

## Adapter Rule

Compatibility transforms must be explicit:

- Use `toMessengerConversationId(...)` to convert public/string IDs to internal messenger IDs.
- Do not use broad casts (`as any`) in composition paths to bridge these differences.

## Ownership

- `messengerCompositionTypes.ts` owns composition control interfaces and ID adapters.
- `MessengerContent.tsx` owns wiring/orchestration between tabs and composed messenger/help views.
- `OpencomMessenger.tsx` owns runtime list/detail state behavior within the canonical control contract.

If composition props evolve, update the canonical type module first, then update both caller and callee in the same change.
