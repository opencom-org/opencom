## 1. Implementation

- [ ] 1.1 Make the React Native SDK source-of-truth boundary explicit around `src/**` versus generated build output.
- [ ] 1.2 Update package/build/release workflow or repository hygiene so generated output no longer obscures authored source for maintainers.
- [ ] 1.3 Ensure contributor-facing guidance and developer workflows point to source-first editing and verification.
- [ ] 1.4 Preserve package runtime and publish behavior while improving source/build separation.

## 2. Verification

- [ ] 2.1 Run targeted React Native SDK tests or package verification for touched workflows.
- [ ] 2.2 Run relevant package typechecks/tests for the RN SDK area.
- [ ] 2.3 Run `openspec validate clean-sdk-source-and-build-boundaries --strict --no-interactive`.
