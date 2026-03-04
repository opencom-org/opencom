## Why

The React Native SDK package is still marked `private` and depends on workspace-only packages, while docs already instruct external installation via `@opencom/react-native-sdk`. There is no release pipeline for SDK packages and npm registry lookups currently return not found, so install guidance is not actionable.

## What Changes

- Define and implement a publishable package graph for mobile SDK distribution (npm and/or GitHub Packages) including all required transitive dependencies.
- Remove workspace-only dependency blockers from publishable packages (or publish required internal dependencies).
- Create a versioned release pipeline that builds, verifies, and publishes SDK artifacts.
- Update Mobile SDK installation docs to match actual distribution and release process.

## Capabilities

### New Capabilities

- `mobile-sdk-package-distribution`: Mobile SDK packages are publishable/installable from configured package registries with automated release workflow.

### Modified Capabilities

- None.

## Impact

- Package manifests for mobile SDK and required dependencies (`private`, `publishConfig`, dependency versions).
- CI/workflow automation for release and publish.
- Mobile SDK installation docs and release runbook.
