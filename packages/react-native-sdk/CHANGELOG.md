# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2024-01-24

### Breaking Changes

- **React Native**: Minimum version increased from 0.72 to 0.73
- **Android**: Minimum SDK increased from 21 to 24 (Android 7.0+)
- **iOS**: Minimum version increased from 13 to 15
- **Peer dependencies**: Changed to permissive (`"*"`) to reduce version conflicts

### Changed

- Switched build tooling from `tsup` to `react-native-builder-bob` for proper React Native library builds
- Added `codegenConfig` for React Native New Architecture support
- Updated package exports to follow Intercom SDK patterns
- Added proper `files` array for npm publishing

### Added

- `tsconfig.build.json` for library builds
- New Architecture (TurboModules) codegen configuration

### Migration Guide

1. Update your React Native version to 0.73 or higher
2. For Android, ensure your `minSdk` is 24 or higher
3. For iOS, ensure your deployment target is iOS 15 or higher
4. Run `pnpm install` to update dependencies
5. Rebuild your app with `npx expo prebuild --clean` (for Expo projects)

## [0.1.0] - Initial Release

- Initial SDK release with messenger, help center, carousels, and push notifications
