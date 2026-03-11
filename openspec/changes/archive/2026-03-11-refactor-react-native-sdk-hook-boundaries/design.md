## Overview

This change refactors the React Native SDK so public hooks and exported components no longer directly carry all generated Convex hook usage, visitor/session resolution, and UI-facing normalization in the same modules. The desired outcome is a clearer internal layering model: transport and gating helpers stay internal, public hooks expose stable ergonomic interfaces, and exported components consume those public hooks or dedicated controllers without re-owning transport concerns.

## Goals

- Separate internal data-access/transport concerns from public SDK hook ergonomics.
- Reduce repeated direct generated Convex hook usage across exported SDK hooks and components.
- Keep visitor/session/config resolution explicit and reusable instead of re-implemented per domain.
- Preserve existing public SDK behavior and compatibility for consuming apps.
- Improve maintainability and testability of SDK data flows.

## Non-Goals

- Redesigning the public SDK feature set or consumer-facing UX in this change.
- Moving SDK data-access logic into app-specific wrapper layers owned by `apps/mobile` or `apps/web`.
- Changing backend contracts or generated API output.
- Forcing the SDK to mirror the exact same internal file layout as app surfaces.

## Architecture

### Internal SDK layering

- Add internal SDK-local adapter or helper modules for generated Convex hook interaction, visitor/session/config resolution, and skip/gating behavior.
- Keep exported hooks focused on stable parameters, return values, and side-effect functions meaningful to SDK consumers.
- Allow exported components/controllers to consume public hooks or dedicated internal controllers instead of duplicating transport logic inline.

### Domain-first migration

- Start with the current March 10, 2026 hotspot cluster for conversations and tickets: `hooks/useConversations.ts`, `hooks/useTickets.ts`, `components/messenger/useConversationDetailController.ts`, and `components/OpencomTicketCreate.tsx`.
- Follow with the home/content/settings/support cluster: `components/OpencomHome.tsx`, `hooks/useArticles.ts`, `hooks/useMessengerSettings.ts`, `hooks/useAutomationSettings.ts`, `hooks/useOfficeHours.ts`, `hooks/useChecklists.ts`, and `hooks/useOutboundMessages.ts`.
- Then migrate the remaining AI/survey/carousel/push supporting cluster: `hooks/useAIAgent.ts`, `hooks/useArticleSuggestions.ts`, `hooks/useSurveyDelivery.ts`, `components/survey/useSurveyController.ts`, `components/OpencomCarousel.tsx`, and `push/index.ts`.
- Avoid leaking internal adapter/helper details into the SDK public surface.

### Boundary design rules

- Public hooks should expose explicit SDK-owned types and ergonomics.
- Internal transport helpers may centralize unavoidable casts, generated type handling, and visitor/session/config lookup.
- Visitor/session/config resolution should be reused rather than repeatedly inlined across hooks.
- Exported components should not grow new direct generated Convex hook usage where an existing internal hook/controller boundary can own it.

### Testing approach

- Add or update focused tests around internal helper behavior and public hook compatibility where migration changes module structure.
- Preserve current public SDK behavior for key flows such as conversation listing, message send/read, ticket list/detail, and home content loading.
- Run targeted SDK tests and typecheck during migration.

## Risks and Mitigations

- Risk: internal refactor accidentally changes public SDK behavior.
  - Mitigation: treat current public hook/component behavior as the compatibility contract and verify parity with focused tests.
- Risk: too much abstraction makes the SDK harder to debug.
  - Mitigation: keep internal layers small and domain-oriented rather than building a universal generic factory.
- Risk: app-level wrapper changes and SDK internal changes drift from each other.
  - Mitigation: align naming and principles where useful, but treat SDK internals as a package-specific concern.

## Rollout Notes

- Establish internal SDK transport/helper boundaries first.
- Migrate the conversations/tickets cluster next, followed by the home/content/settings/support cluster.
- Follow with the remaining AI/survey/carousel/push supporting cluster incrementally.
