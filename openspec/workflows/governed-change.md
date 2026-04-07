# Governed Change Workflow

**Schema:** `sds-governed`  
**When to use:** Regulated, high-risk, or cross-cutting changes where governance artifacts are required for approval.

---

## Required Artifacts

Includes all brownfield-tier artifacts plus:

| Artifact | File | Authored by | Build artifact |
|---|---|---|---|
| Proposal | `proposal.md` | Human | No |
| Brief | `brief.md` | Analyst role | No |
| PRD | `prd.md` | PM role | No |
| Architecture | `architecture.md` | Architect role | No |
| Design | `design.md` | Human | No |
| Tasks | `tasks.md` | Human | No |
| Delta spec | `specs/<capability>/spec.md` | Human | No |
| Brownfield notes | `brownfield-notes.md` | Human / `/sds:brownfield-scan` | No |
| Controls | `controls.md` | Governor role | No |
| Risk | `risk.md` | Governor role | No |
| Validation | `validation.md` | Verifier role | No |
| Traceability | `traceability.md` | `/sds:traceability-check` | **Yes** |
| Capability definition | `capability.yaml` | Human | No |
| Capability surface | `capability_surface.md` | `/sds:compute-surface` | **Yes** |
| Simulation | `simulation.md` | `/sds:simulate-capability` | **Yes** |

Build artifacts must never be manually edited (except the `traceability_overrides` section in `traceability.md`).

---

## Approval Sequence

1. Author `proposal.md`, `brief.md`, `prd.md`, `architecture.md`, `design.md`
2. Author `capability.yaml` with composability constraints and BAML binding
3. Author `controls.md` and `risk.md` (Governor role — context-isolated review pass)
4. Run `/sds:compute-surface` → `capability_surface.md`
5. Run `/sds:simulate-capability` → `simulation.md`
6. Verify no open CRITICAL findings in `simulation.md`
7. Author `validation.md` (Verifier role — context-isolated review pass)
8. Run `/sds:traceability-check` → `traceability.md` (must pass with no errors)
9. Human approver reviews AI persona review artifacts and change artifacts
10. Human approval recorded as approval token

---

## Validation

Validation at governed tier produces **errors** that block promotion. All validation failures must be resolved before approval.

Required checks:
- [ ] `controls.md` present with enforcement levels and evidence types for every `<control>`
- [ ] `risk.md` present with at least one `<risk>` block per external capability dependency
- [ ] `validation.md` present with pre-approval, pre-merge, and pre-release gates populated
- [ ] `traceability.md` passes `/sds:traceability-check` with no errors:
  - Every `<requirement>` linked to at least one `<scenario>` or `<evidence>`
  - Every `<control>` linked to at least one `<requirement>` and one `<evidence>`
  - Every `<decision>` in `architecture.md` linked to at least one `<requirement>`
- [ ] `simulation.md` contains no open CRITICAL findings
- [ ] `capability_surface.md` is current (regenerated after last edit to `capability.yaml` or `controls.md`)
- [ ] Governor and Verifier review artifacts are signed and timestamped (context-isolated passes)
- [ ] Human approver has reviewed and issued approval token

---

## Context Isolation Requirement

At governed tier, Governor and Verifier AI persona reviews **must** be executed as independent invocations with scoped context. Each pass receives only its owned artifacts and direct dependencies — not the full conversation history of prior review passes.

This ensures the separation-of-concerns guarantee is structural, not cosmetic. Run `/sds:governance-review --role governor` and `/sds:governance-review --role verifier` as separate sessions.

---

## Post-Approval

Before deployment to a Lighthouse execution envelope:
1. Run `/sds:check-drift` — must pass with no violations
2. `/sds:extract-library-parts` extraction report must be explicitly acknowledged (accepted or deferred with justification in `library/extraction-backlog.yaml`)
