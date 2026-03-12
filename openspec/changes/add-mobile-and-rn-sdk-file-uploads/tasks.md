## 1. RN SDK Attachment Boundaries

- [ ] 1.1 Add React Native attachment types, picker adapter contracts, and upload helpers that map local device files onto the existing Convex staged-upload flow.
- [ ] 1.2 Extend `packages/react-native-sdk` conversation and ticket hooks/controllers to read attachment descriptors and send attachment IDs for messenger messages, ticket creation, and ticket replies.
- [ ] 1.3 Update RN SDK hardening and contract tests for the new attachment transport boundaries and public component contracts.

## 2. RN SDK Messenger And Ticket UI

- [ ] 2.1 Add attachment queueing, upload error feedback, and send controls to the RN SDK messenger conversation experience.
- [ ] 2.2 Add attachment selection, rendering, and removal UX to RN SDK ticket creation.
- [ ] 2.3 Add attachment rendering and reply-upload UX to RN SDK ticket detail.

## 3. First-Party Mobile Conversation Support

- [ ] 3.1 Wire an Expo-backed attachment picker into the first-party mobile app and normalize picked files for upload.
- [ ] 3.2 Extend mobile Convex wrapper types and conversation send/read flows to handle attachment descriptors and attachment IDs.
- [ ] 3.3 Update the mobile agent conversation screen to queue, send, render, and open attachments with actionable validation feedback.

## 4. Verification

- [ ] 4.1 Add or update RN SDK tests covering attachment queue state, validation failures, and message/ticket attachment rendering.
- [ ] 4.2 Add or update mobile tests and hardening guards for attachment-aware conversation flows.
- [ ] 4.3 Run strict `openspec validate add-mobile-and-rn-sdk-file-uploads --strict --no-interactive` once the change artifacts and implementation are ready.
