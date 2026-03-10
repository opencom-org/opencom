## 1. Foundation

- [ ] 1.1 Define internal SDK boundaries for generated Convex hook access, visitor/session/config resolution, and public hook ergonomics.
- [ ] 1.2 Add reusable internal helpers/adapters for transport and gating behavior where repeated patterns exist.
- [ ] 1.3 Ensure unavoidable casts or generated type escape hatches are centralized in internal SDK helper boundaries.

## 2. Initial domain migrations

- [ ] 2.1 Refactor the current conversations/tickets cluster onto the new internal boundary pattern: `src/hooks/useConversations.ts`, `src/hooks/useTickets.ts`, `src/components/messenger/useConversationDetailController.ts`, and `src/components/OpencomTicketCreate.tsx`.
- [ ] 2.2 Refactor the current home/content/settings/support cluster onto the new pattern: `src/components/OpencomHome.tsx`, `src/hooks/useArticles.ts`, `src/hooks/useMessengerSettings.ts`, `src/hooks/useAutomationSettings.ts`, `src/hooks/useOfficeHours.ts`, `src/hooks/useChecklists.ts`, and `src/hooks/useOutboundMessages.ts`.
- [ ] 2.3 Refactor the remaining AI/survey/carousel/push supporting cluster and any exported controllers that still duplicate transport logic inline: `src/hooks/useAIAgent.ts`, `src/hooks/useArticleSuggestions.ts`, `src/hooks/useSurveyDelivery.ts`, `src/components/survey/useSurveyController.ts`, `src/components/OpencomCarousel.tsx`, and `src/push/index.ts`.

## 3. Compatibility verification

- [ ] 3.1 Confirm public SDK hooks preserve existing return semantics and side-effect behavior for consuming apps.
- [ ] 3.2 Add or update targeted SDK tests for refactored domains.
- [ ] 3.3 Run relevant SDK typecheck/test commands for touched code.
- [ ] 3.4 Run `openspec validate refactor-react-native-sdk-hook-boundaries --strict --no-interactive`.
