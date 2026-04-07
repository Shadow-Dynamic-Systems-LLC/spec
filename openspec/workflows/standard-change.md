# Standard Change Workflow

**Schema:** `sds-standard`  
**When to use:** Feature-level work with defined scope, stakeholders, and architecture decisions.

---

## Required Artifacts

Includes all lean-tier artifacts plus:

| Artifact | File | Purpose |
|---|---|---|
| Proposal | `proposal.md` | Why this change exists and why now |
| Brief | `brief.md` | Stakeholder map, workflow context, problem framing |
| PRD | `prd.md` | Outcomes, requirements, acceptance criteria |
| Architecture | `architecture.md` | System topology, interfaces, tradeoffs |
| Design | `design.md` | Technical decisions specific to this change |
| Tasks | `tasks.md` | Ordered implementation checklist |
| Delta spec | `specs/<capability>/spec.md` | What the system does after this change |

---

## Artifact Scope Rules

Each artifact has strict scope boundaries. Overlapping content between artifacts is a spec quality failure.

- `proposal.md` — motivation and business context only; no requirements or architecture decisions
- `brief.md` — stakeholder and environment context only; no requirements or acceptance criteria
- `prd.md` — requirements and acceptance criteria only; no architecture decisions
- `architecture.md` — topology, interfaces, and tradeoffs only; no requirements
- `design.md` — implementation decisions specific to this change; no requirements or acceptance criteria
- `tasks.md` — implementation checklist only; no analysis or justification

---

## AI-Native Format

All structured blocks in standard-tier artifacts use XML tags with `id` attributes:

```markdown
<requirement id="REQ-001">
The system SHALL ...
</requirement>

<decision id="ADR-001">
We chose X over Y because ...
</decision>
```

This format enables AI agents to parse tag-bounded blocks precisely while humans read headings and prose.

---

## Validation

Validation at standard tier produces **warnings**. Warnings do not block promotion.

Checklist items (in addition to lean):
- [ ] `brief.md` exists with Stakeholders and Problem Statement sections
- [ ] `prd.md` exists with at least one `<requirement>` block
- [ ] `architecture.md` exists with at least one `<decision>` block
- [ ] Every `<requirement>` has at least one linked `<scenario>` or `<evidence>`
- [ ] Every `<decision>` links to at least one `<requirement>`

---

## Promotion

Promoting to `specs/` from standard tier:
1. Run `/sds:traceability-check` — warnings at this tier, errors block at governed
2. Run `/sds:extract-library-parts` — extraction report is informational

---

## Tier Exit Criteria

Exit standard tier and move to **brownfield** when any of the following apply:
- Change touches undocumented or legacy systems
- Full dependency graph is unknown at change start
- External integrations have undocumented behavior or implicit contracts

Exit standard tier and move to **governed** when any of the following apply:
- Change is in a regulated domain (healthcare, insurance, financial)
- Change affects cross-cutting security, audit, or compliance concerns
- Change carries high rollback risk or irreversible effects
