# Lean Change Workflow

**Schema:** `sds-lean`  
**When to use:** Small, low-risk, local changes with narrow scope and no external dependencies.

---

## Required Artifacts

| Artifact | File | Purpose |
|---|---|---|
| Proposal | `proposal.md` | Why this change exists and why now |
| Tasks | `tasks.md` | Ordered implementation checklist |
| Delta spec | `specs/<capability>/spec.md` | What the system does after this change |

## Optional Artifacts

| Artifact | File | When to add |
|---|---|---|
| Design | `design.md` | If implementation approach is non-obvious |

---

## Validation

Validation at lean tier produces **warnings**. Warnings do not block promotion.

Checklist items:
- [ ] `proposal.md` exists and has a non-empty Why section
- [ ] `tasks.md` exists with at least one checkbox item
- [ ] At least one delta spec file exists under `specs/`
- [ ] No requirement in any spec lacks a scenario

---

## Promotion

Promoting to `specs/` from lean tier:
1. Run `/sds:traceability-check` — warnings do not block, errors do
2. Run `/sds:extract-library-parts` — extraction report is informational

To promote to a higher tier at any point, change `.openspec.yaml` schema to `sds-standard`, `sds-brownfield`, or `sds-governed` and scaffold the missing artifacts using `/sds:new-change --tier <tier>` or by copying templates from `schemas/sds-<tier>/templates/`.

---

## Tier Exit Criteria

Exit lean tier and move to **standard** when any of the following apply:
- Change introduces a new external dependency
- Change affects more than one team or service boundary
- Change modifies existing requirements (not just adds new ones)
- Change involves a security or data model decision
