# Naming Conventions

---

## Capability IDs

Capability IDs are snake_case strings. They must be globally unique within `library/capability/registry.yaml`.

- **Format:** `<verb_noun>` or `<noun_noun>`
- **Examples:** `human_approval_gate`, `audit_log`, `cost_gate`, `scope_boundary`
- **Avoid:** camelCase, hyphens, version suffixes in the ID (use the `version` field)

## Change IDs

Change directories use kebab-case. Prefix with a sequential number for ordered histories.

- **Format:** `<short-description>` (kebab-case, all lowercase) or prefixed as `chg-<nnnn>-<short-description>` for ordered histories
- **Examples:** `chg-0042-orchestration-approval-layer`, `add-qa-smoke-harness`
- **Note:** The `CHG-NNNN` uppercase prefix is used in documentation as a human-readable reference (e.g., "CHG-0042" in prose). The actual directory name must be lowercase to pass `validateChangeName`.

## Artifact File Names

All artifact files use the exact names defined in the workflow schema. Do not rename or add suffixes.

| Artifact | File |
|---|---|
| Proposal | `proposal.md` |
| Brief | `brief.md` |
| PRD | `prd.md` |
| Architecture | `architecture.md` |
| Design | `design.md` |
| Tasks | `tasks.md` |
| Controls | `controls.md` |
| Risk | `risk.md` |
| Validation | `validation.md` |
| Traceability | `traceability.md` (build artifact) |
| Capability definition | `capability.yaml` |
| Capability surface | `capability_surface.md` (build artifact) |
| Simulation | `simulation.md` |
| Change metadata | `.openspec.yaml` |

## XML Tag IDs

Structured blocks use XML tags with `id` attributes. IDs must match the corresponding registry entry.

- **Requirement IDs:** `REQ-<NNN>` (e.g., `REQ-001`, `REQ-042`)
- **Architecture decision IDs:** `ADR-<NNN>` (e.g., `ADR-001`)
- **Control IDs:** `CTL-<NNN>` (e.g., `CTL-007`)
- **Risk IDs:** `RSK-<NNN>` (e.g., `RSK-003`)
- **Evidence IDs:** `EVD-<NNN>` (e.g., `EVD-012`)
- **Scenario IDs:** `SCN-<NNN>` (e.g., `SCN-005`)
- **Capability IDs:** snake_case, from registry (e.g., `human_approval_gate`)

## Schema Names

SDS workflow schemas use the `sds-` prefix followed by the tier name.

- `sds-lean`
- `sds-standard`
- `sds-brownfield`
- `sds-governed`

## Library Part Files

Library templates use the `.template.md` suffix. Snippets use `<type>-snippets.md`. Checklists use `<scope>-checklist.md`.

## Spec Directories

Spec directory names under `specs/` are kebab-case. They correspond to capability IDs but use hyphens instead of underscores (e.g., capability `human_approval_gate` → spec dir `human-approval-gate`).
