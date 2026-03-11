# Refactor Progress: Web Messenger Settings Decomposition (2026-03-07)

## Scope

- `apps/web/src/app/settings/MessengerSettingsSection.tsx`
- `apps/web/src/app/settings/MessengerSettingsFormFields.tsx`
- `apps/web/src/app/settings/MessengerSettingsPreview.tsx`
- `apps/web/src/app/settings/SettingsToggleRow.tsx`
- `apps/web/src/app/settings/messengerSettingsForm.ts`
- `apps/web/src/app/settings/messengerSettingsForm.test.ts`

## Problem Addressed

After the public messenger/home contract convergence and Convex backend decomposition passes, the next remaining concentration in this track was the web authoring surface.

Before this pass:

- `MessengerSettingsSection.tsx` mixed query/mutation wiring, local form-state normalization, language-toggle rules, file-upload state, and preview rendering inline.
- The route file was still the practical controller for both the authoring form and the live preview.
- The section was harder to reason about than it needed to be for a mostly standard settings surface.

## What Was Refactored

1. Extracted form-state initialization and mutation shaping into `messengerSettingsForm.ts`.
2. Moved the language-toggle rule into the shared form helper so it no longer lived inline in the route component.
3. Extracted the authoring column into `MessengerSettingsFormFields.tsx`.
4. Extracted the preview column into `MessengerSettingsPreview.tsx`.
5. Added `SettingsToggleRow.tsx` to remove repeated toggle-row markup from the form surface.
6. Reduced `MessengerSettingsSection.tsx` to data loading, mutation orchestration, upload/delete handlers, and top-level composition.
7. Added focused helper coverage in `messengerSettingsForm.test.ts`.

## Result

- `MessengerSettingsSection.tsx` is down to `179` lines from `570`.
- The route-local concentration is now mostly data wiring and error handling, not mixed form/view logic.
- The extracted modules make the remaining authoring surface much easier to change without reading the entire section at once.
- This track is no longer blocked on the messenger settings authoring controller.

## What Still Appears To Remain In This Track

- There is no obvious mandatory continuation inside `MessengerSettingsSection.tsx`.
- If the messenger/home track continues, the next likely surface is `HomeSettingsSection.tsx`, not the now-slimmed messenger settings section.
- Further work here should be optional follow-up inside isolated web modules, not another route-shell split.

## Compatibility Notes

- No Convex endpoint names changed.
- No user-visible settings fields or preview affordances were intentionally changed.
- This was a structure-only pass on the web authoring surface.

## Verification

Passed:

- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/web test -- --run src/app/settings/MessengerSettingsSection.test.tsx src/app/settings/messengerSettingsForm.test.ts`

Notes:

- The existing `MessengerSettingsSection` error-feedback test still emits expected stderr from the deliberate rejected-save case.
- No dedicated security or home-settings tests were added in this slice because the changes stayed inside the messenger settings authoring surface.
