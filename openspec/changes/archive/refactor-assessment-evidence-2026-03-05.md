# Refactor Assessment Evidence (2026-03-05)

## 1) Shared Business Logic Is Duplicated Across Surfaces

| Theme | Evidence | Refactor Opportunity |
|---|---|---|
| Markdown rendering + sanitization | `apps/web/src/lib/parseMarkdown.ts` and `apps/widget/src/utils/parseMarkdown.ts` are near-duplicates (same allowed tags/attrs, same frontmatter strip, same link/media hardening). | Extract to a DOM-scoped shared module (`packages/web-shared`), keep one parser/sanitizer test suite, re-export helpers per frontend if needed. |
| Unread cue engine | `apps/web/src/lib/inboxNotificationCues.ts` and `apps/widget/src/lib/widgetNotificationCues.ts` share the same snapshot/increase/suppress algorithm shape with naming/count-field differences. | Create a generic unread-cue core (`buildSnapshot`, `getIncreases`, `shouldSuppress`) with thin adapters for agent vs visitor fields. |
| Visitor human-readable ID generation | `apps/web/src/lib/visitorIdentity.ts` and `packages/convex/convex/visitorReadableId.ts` contain the same adjective/noun dictionaries and hash/salt strategy (wordlists are byte-identical for adjective+noun sections). | Make one source of truth for deterministic label generation (shared utility + explicit stability contract tests). |
| Messenger settings defaults | Defaults duplicated across `packages/convex/convex/messengerSettings.ts`, `apps/widget/src/hooks/useWidgetSettings.ts`, and `packages/react-native-sdk/src/hooks/useMessengerSettings.ts`. | Move contract + defaults into shared package; Convex returns authoritative shape, clients consume shared default merger. |
| Home config model + defaults | Repeated in `packages/convex/convex/messengerSettings.ts`, `apps/web/src/app/settings/HomeSettingsSection.tsx`, `apps/widget/src/components/Home.tsx`, and `packages/react-native-sdk/src/components/OpencomHome.tsx`. | Centralize `HomeCard`, `HomeTab`, `HomeConfig`, and default/normalization logic; avoid per-surface drift. |
| Audience rule contract | Frontend type system in `apps/web/src/components/AudienceRuleBuilder.tsx` duplicates backend model in `packages/convex/convex/audienceRules.ts` and validators in `packages/convex/convex/validators.ts`. | Publish shared audience-rule types + schema adapters; use on both frontend and backend validators. |
| Backend URL normalization | `normalizeBackendUrl` exists in both `packages/types/src/backendValidation.ts` and `apps/web/src/contexts/BackendContext.tsx`; mobile uses ad-hoc normalization too. | Use shared normalization/validation utilities from `@opencom/types` everywhere. |

## 2) Business Logic Is Still Heavily Coupled To UI Containers

### Web

- `apps/web/src/app/inbox/page.tsx`
  - 1732 lines, 15 `useQuery/useMutation/useAction` hooks, 13 `useEffect` hooks.
  - Handles routing sync, optimistic patching, suggestions loading, title mutation, notification side effects, and rendering in one page.
- `apps/web/src/app/settings/page.tsx`
  - 1360 lines, many independent settings concerns mixed: workspace membership, signup policy, help-center policy, email channel config, transfer ownership.
- `apps/web/src/app/campaigns/series/[id]/page.tsx`
  - 1204 lines with rule parsing, activation-error parsing, block graph editing, and persistence orchestration co-located with render logic.

### Widget

- `apps/widget/src/Widget.tsx`
  - 1413 lines, 21 data hooks (`useQuery/useMutation`), 9 `useState` + high orchestration density.
  - Owns session boot/refresh integration, view routing, ticket/help/tour/survey/outbound orchestration.
- `apps/widget/src/components/ConversationView.tsx`
  - 791 lines with messaging, AI actions, CSAT gating, email-capture logic, and markdown rendering in one component.

### External signal

`react-doctor` confirms this trend:

- Web: large-component and effect/state orchestration warnings across key pages including inbox/settings/series.
- Widget: flags `Widget` for high `useState` count and `OutboundOverlay`/`ConversationView`/`TourOverlay` as oversized components.

## 3) Convex Authorization + Domain Patterns Are Inconsistent

### Mixed auth patterns

- Auth wrappers (`authQuery/authMutation/authAction`) are used in some modules, but many modules still perform manual `getAuthenticatedUserFromSession` + `requirePermission` + `hasPermission` logic.
- High-repetition examples:
  - `packages/convex/convex/workspaces.ts` (18 auth+perm calls)
  - `packages/convex/convex/workspaceMembers.ts` (18)
  - `packages/convex/convex/tags.ts` (16)
  - `packages/convex/convex/identityVerification.ts` (14)
  - `packages/convex/convex/segments.ts` (14)

### Same workflow repeated in many CRUD modules

- `assignmentRules.ts`, `commonIssueButtons.ts`, `segments.ts`, `ticketForms.ts`, `checklists.ts` each repeat similar list/get/create/update/remove/reorder with similar permission gates and error styles.

### Public/private API semantics are inconsistent in naming

- Example: `automationSettings.get` is auth-gated, while `automationSettings.getOrCreate` is effectively public-facing for widget consumption, but naming does not signal this (unlike `messengerSettings.getPublicSettings`).

### Utility fragmentation

- `packages/convex/convex/utils/validation.ts` exposes many validators/sanitizers but appears unused by domain modules; `messengerSettings.ts` defines local `isValidUrl` instead.

## 4) Cross-App References Highlight Better Patterns Already Present

- `apps/mobile/src/utils/workspaceSelection.ts` cleanly extracts workspace-resolution rules, while web keeps similar logic embedded in `apps/web/src/contexts/AuthContext.tsx`.
- `packages/react-native-sdk/src/OpencomSDK.ts` uses shared `@opencom/sdk-core` state/client/session utilities extensively.
- `apps/widget` and `apps/web` mostly bypass these shared `sdk-core` abstractions and directly implement orchestration in app code.

## 5) Dead/Partial Abstractions Increase Drift

- `apps/widget/src/components/WidgetContext.tsx` is currently unused.
- `apps/web/src/components/TriggerConfigEditor.tsx` and `apps/web/src/components/CollapsibleSection.tsx` are currently unused.
- This indicates refactors were started but not consistently adopted, leaving multiple architectural paths in parallel.

## 6) Implications For apps/mobile + sdk-core + React Native SDK

| Surface | Evidence | Plan Implication |
|---|---|---|
| Mobile app (`apps/mobile`) | Mobile depends on `@opencom/types` + `@opencom/convex`, not `@opencom/sdk-core` (`apps/mobile/package.json`). Backend selection already uses shared validation (`apps/mobile/src/contexts/BackendContext.tsx`), and workspace selection is cleanly extracted/tested (`apps/mobile/src/utils/workspaceSelection.ts`, `apps/mobile/src/utils/__tests__/workspaceSelection.test.ts`). | No plan shape change. Keep “workspace/backend consolidation” as-is; promote mobile’s workspace resolver pattern to web and standardize backend normalization usage (avoid ad-hoc `url.replace(/\/$/, "")` branches). |
| sdk-core (`packages/sdk-core`) | `validateConvexUrl` allows `http://` for localhost only (`packages/sdk-core/src/api/client.ts`) and normalizes URL for client init. Contract tests assert specific Convex function references/args (`packages/sdk-core/tests/contracts.test.ts`). | Treat sdk-core as a compatibility boundary: do not silently rename/remove Convex functions used by sdk-core paths, and keep surface-specific URL-security semantics while centralizing common normalization primitives. |
| React Native SDK (`packages/react-native-sdk`) | RN SDK re-exports many public hooks/types (`packages/react-native-sdk/src/index.ts`). It duplicates messenger/home defaults and local interfaces (`packages/react-native-sdk/src/hooks/useMessengerSettings.ts`, `packages/react-native-sdk/src/components/OpencomHome.tsx`). `useAutomationSettings` calls `api.automationSettings.get` (auth-gated) and falls back to defaults (`packages/react-native-sdk/src/hooks/useAutomationSettings.ts`), while widget uses `api.automationSettings.getOrCreate` (`apps/widget/src/Widget.tsx`). RN components also build a second `ConvexReactClient` directly from raw config URL (`packages/react-native-sdk/src/components/Opencom.tsx`, `packages/react-native-sdk/src/components/OpencomProvider.tsx`). | No plan shape change. Add guardrails: preserve exported SDK contracts while extracting shared defaults/types, enforce explicit public endpoint naming with compatibility aliases, and align RN client URL handling with sdk-core normalization semantics. |
| Existing OpenSpec tracks | Active changes already cover RN modularization/type safety and mobile parity (`openspec/changes/split-react-native-sdk-orchestrator`, `decompose-react-native-sdk-messenger-containers`, `tighten-react-native-sdk-messenger-types`, `parity-mobile-inbox-ai-review-and-visitors`). | Keep current roadmap; map each refactor task to these existing tracks so workstreams converge instead of duplicating refactors. |
