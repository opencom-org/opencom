## ADDED Requirements

### Requirement: Active residual-hardening proposals MUST distinguish unfinished work from completed slices

The system MUST track only unfinished Convex ref-boundary cleanup in the active owning change and MUST explicitly mark already completed audit items as satisfied instead of reopening them as default implementation work.

#### Scenario: Repo-wide audit seeds a follow-up cleanup change

- **WHEN** the team converts a repo-wide hardening audit into an owning follow-up change
- **THEN** the proposal and task list SHALL enumerate only the remaining unfinished file clusters and explicit accepted exceptions
- **AND** already completed slices, such as verified sdk-core route migrations or completed embedding concurrency refactors, SHALL remain out of scope unless new evidence shows a remaining gap
