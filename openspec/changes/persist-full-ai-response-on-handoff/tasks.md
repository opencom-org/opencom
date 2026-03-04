## 1. Data Contract Extension

- [ ] 1.1 Extend AI response storage schema/contracts with optional generated-candidate context fields for handoff records.
- [ ] 1.2 Ensure backward compatibility for existing handoff records without candidate context.

## 2. Handoff Path Updates

- [ ] 2.1 Update AI generation handoff branch to persist generated candidate response context alongside delivered handoff message context.
- [ ] 2.2 Preserve existing visitor-facing single handoff message thread behavior.

## 3. Review Surface Integration

- [ ] 3.1 Update AI review query payloads to expose generated vs delivered response contexts.
- [ ] 3.2 Update AI review UI to label and display full handoff traceability context.

## 4. Verification

- [ ] 4.1 Add tests for handoff persistence payload integrity and compatibility.
- [ ] 4.2 Run targeted Convex and web checks for AI review paths.
