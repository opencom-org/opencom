## Overview

This change improves maintainability in the React Native SDK by making authored source the clear implementation authority and reducing confusion caused by adjacent generated output. The main design question is not whether artifacts exist, but how repository structure, tooling, and contributor workflow make source ownership obvious.

## Goals

- Make `src/**` the unambiguous source of truth for RN SDK changes.
- Reduce accidental contributor interaction with generated `lib/**` output.
- Keep release packaging and runtime compatibility intact.
- Improve code search and review signal for SDK work.

## Non-Goals

- Redesigning the SDK public API.
- Rewriting the SDK architecture beyond what boundary cleanup requires.
- Changing mobile runtime behavior.

## Architecture

### Source-of-truth boundary

- Keep authored implementation in `src/**`.
- Ensure generated artifacts are treated as outputs of the build/release pipeline rather than routine editing targets.
- Where generated files remain in the repository, tooling and documentation should steer maintainers away from editing them directly.

### Workflow alignment

- Align package scripts, release flow, and contributor instructions with a source-first model.
- Prefer search, testing, and implementation workflows that operate on `src/**` and generated outputs only as verification artifacts.

## Risks and Mitigations

- Risk: package publish flow depends on committed generated outputs.
  - Mitigation: preserve compatibility while clarifying ownership and, if needed, sequencing workflow updates.
- Risk: source/build separation becomes documentation-only.
  - Mitigation: back it with tooling, exclusions, or package conventions where feasible.
- Risk: contributors still search generated outputs first.
  - Mitigation: pair repository cleanup with indexing/search guidance and package-level conventions.

## Rollout Notes

- Start by clarifying and enforcing source-of-truth boundaries.
- Follow with any packaging or release workflow updates needed to support that model.
