# rn-sdk-source-build-boundaries Specification

## Purpose

Define contributor-facing source and build artifact boundaries for the React Native SDK.

## Requirements

### Requirement: React Native SDK implementation changes MUST be source-first

Covered React Native SDK implementation changes SHALL be made against authored source modules rather than requiring direct edits to generated build artifacts.

#### Scenario: Contributor updates SDK messenger behavior

- **WHEN** a maintainer updates covered RN SDK messenger behavior
- **THEN** the maintained implementation SHALL live in authored source modules
- **AND** generated outputs SHALL not be the required editing surface for the change

### Requirement: Source/build cleanup MUST preserve published runtime behavior

Source/build boundary improvements SHALL preserve the existing runtime behavior and packaging contract of the published SDK.

#### Scenario: Source-first workflow still produces compatible package output

- **WHEN** the RN SDK is built or prepared for release after this change
- **THEN** generated package output SHALL remain compatible with existing public package expectations
- **AND** the repository workflow SHALL continue to support package publication
