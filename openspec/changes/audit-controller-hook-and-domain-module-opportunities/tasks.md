## 1. Audit framework

- [ ] 1.1 Define practical heuristics for identifying orchestration-heavy route/controller modules.
- [ ] 1.2 Define the preferred controller-hook/domain-module decomposition pattern and its boundaries.
- [ ] 1.3 Clarify when explicit prop passing remains preferable and when context is justified.

## 2. Opportunity inventory

- [ ] 2.1 Survey `apps/web` for high-value decomposition candidates.
- [ ] 2.2 Survey `apps/widget` and `apps/mobile` for similar controller-sprawl candidates.
- [ ] 2.3 Survey shared frontend packages for exported controller/hook modules with mixed responsibilities.
- [ ] 2.4 Produce a prioritized inventory with rationale and recommended extraction boundaries.

## 3. Guidance updates

- [ ] 3.1 Update relevant OpenSpec specs/guidance to promote controller-hook/domain-module decomposition as a preferred modularity pattern where appropriate.
- [ ] 3.2 Cross-reference existing modularity and wrapper-hook changes so future proposals can build on them coherently.

## 4. Verification

- [ ] 4.1 Ensure the audit inventory distinguishes recommendations from committed implementation work.
- [ ] 4.2 Run `openspec validate audit-controller-hook-and-domain-module-opportunities --strict --no-interactive`.
