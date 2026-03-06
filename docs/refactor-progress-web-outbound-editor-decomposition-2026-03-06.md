# Refactor Progress: Web Outbound Editor Decomposition (2026-03-06)

## Slice

- `decompose-web-outbound-editor` (P0, in progress)

## Why

`apps/web/src/app/outbound/[id]/page.tsx` still owned several large editing panels directly even after the earlier form-state extraction pass.
That left trigger configuration, click-action configuration, and message UI metadata mixed into the route instead of being isolated behind focused authoring modules.

## What Changed In This Pass

1. Extracted the trigger settings UI into a dedicated route-local panel:
   - `apps/web/src/app/outbound/[id]/OutboundTriggerPanel.tsx`
2. Extracted the click-action configuration UI into a dedicated route-local panel:
   - `apps/web/src/app/outbound/[id]/OutboundClickActionPanel.tsx`
3. Centralized outbound route UI metadata shared by the list and editor pages:
   - `apps/web/src/app/outbound/outboundMessageUi.tsx`
   - Moved message-type icon rendering and status badge styling out of the routes.
4. Extended outbound editor helpers with shared authoring metadata and preview summary formatting:
   - `apps/web/src/app/outbound/[id]/editorState.ts`
   - Added:
     - `CLICK_ACTION_OPTIONS`
     - `POST_PRIMARY_ACTION_OPTIONS`
     - `WIDGET_TAB_OPTIONS`
     - `getClickActionSummary`
5. Added a focused route-level helper test to pin down the extracted preview summary/default-state behavior:
   - `apps/web/src/app/outbound/[id]/editorState.test.ts`
6. Rewired the outbound list and editor routes to consume the new panels/helpers without changing runtime authoring behavior:
   - `apps/web/src/app/outbound/page.tsx`
   - `apps/web/src/app/outbound/[id]/page.tsx`
7. Continued the editor decomposition by extracting the remaining large route-local render branches:
   - Added a shared field label component:
     - `apps/web/src/app/outbound/[id]/OutboundFieldLabel.tsx`
   - Moved message-type-specific content editing into:
     - `apps/web/src/app/outbound/[id]/OutboundContentEditor.tsx`
   - Moved preview rendering into:
     - `apps/web/src/app/outbound/[id]/OutboundPreviewPanel.tsx`
8. Extended editor-state helpers with preview button derivation used by the preview module:
   - `apps/web/src/app/outbound/[id]/editorState.ts`
   - Added:
     - `getPostPreviewButtons`
9. Finished the remaining live editor sections by extracting:
   - header/action toolbar:
     - `apps/web/src/app/outbound/[id]/OutboundEditorHeader.tsx`
   - frequency panel:
     - `apps/web/src/app/outbound/[id]/OutboundFrequencyPanel.tsx`
   - statistics panel:
     - `apps/web/src/app/outbound/[id]/OutboundStatisticsPanel.tsx`

## Verification Run Notes

Executed in this pass:

- `pnpm --filter @opencom/web test -- --run 'src/app/outbound/[id]/editorState.test.ts'` -> pass (`4` tests)
- `pnpm --filter @opencom/web typecheck` -> pass
- `pnpm web:test:e2e -- apps/web/e2e/outbound.spec.ts --project=chromium` -> pass (`36` passed, `0` unexpected)

## Notes

- The outbound editor route was reduced from roughly `634` lines to roughly `235` lines by moving all live section rendering out of the page component.
- Further outbound-editor work is now mostly optional orchestration-hook extraction or formalizing future work as a dedicated OpenSpec change.
