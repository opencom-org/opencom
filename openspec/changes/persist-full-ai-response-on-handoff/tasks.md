## 1. Data Contract Extension

- [x] 1.1 Extend AI response storage schema/contracts with optional generated-candidate context fields for handoff records.
- [x] 1.2 Ensure backward compatibility for existing handoff records without candidate context.

## 2. Handoff Path Updates

- [x] 2.1 Update AI generation handoff branch to persist generated candidate response context alongside delivered handoff message context.
- [x] 2.2 Preserve existing visitor-facing single handoff message thread behavior.

## 3. Review Surface Integration

- [x] 3.1 Update AI review query payloads to expose generated vs delivered response contexts.
- [x] 3.2 Update AI review UI to label and display full handoff traceability context.

## 4. Verification

- [x] 4.1 Add tests for handoff persistence payload integrity and compatibility.
- [x] 4.2 Run targeted Convex and web checks for AI review paths.
