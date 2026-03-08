## Why

The React Native SDK currently mixes authored source modules with generated build output in the developer-visible package layout. This makes code exploration noisier, increases the chance of editing the wrong files, and raises the contribution cost for routine SDK changes.

## What Changes

- Establish a clearer source-of-truth boundary for the React Native SDK so contributors work from authored source modules.
- Reduce developer-facing dependence on committed generated output during routine code exploration and maintenance.
- Clarify or adjust package/release workflows so build artifacts do not obscure maintained source.
- Preserve published package behavior and existing runtime contracts.

## Capabilities

### New Capabilities
- `rn-sdk-source-build-boundaries`: Covers contributor-facing requirements for separating authored source from generated SDK build artifacts.

### Modified Capabilities
- `rn-sdk-orchestrator-modularity`: Clarify that modular RN SDK work must remain source-first and not require editing generated artifacts.
- `rn-sdk-messenger-container-modularity`: Ensure container modularity work remains anchored in authored source modules.

## Impact

- Affected code: `packages/react-native-sdk/src/**`, `packages/react-native-sdk/lib/**`, package build/release workflow, and contributor guidance.
- Affected contributors: SDK maintainers and anyone exploring the RN SDK package.
- Dependencies: no product behavior changes intended; build/release workflow and repository hygiene may change.
