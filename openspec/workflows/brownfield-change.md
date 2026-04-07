# Brownfield Change Workflow

**Schema:** `sds-brownfield`  
**When to use:** Changes to undocumented or legacy systems where the full dependency graph is unknown at change start.

---

## Required Artifacts

Includes all standard-tier artifacts plus:

| Artifact | File | Purpose |
|---|---|---|
| Proposal | `proposal.md` | Why this change exists and why now |
| Brief | `brief.md` | Stakeholder map, workflow context, problem framing |
| PRD | `prd.md` | Outcomes, requirements, acceptance criteria |
| Architecture | `architecture.md` | System topology, interfaces, tradeoffs |
| Design | `design.md` | Technical decisions specific to this change |
| Tasks | `tasks.md` | Ordered implementation checklist |
| Delta spec | `specs/<capability>/spec.md` | What the system does after this change |
| Brownfield notes | `brownfield-notes.md` | Discovery findings, dependency map, unknown inventory |

---

## Brownfield Discovery Phase

Before authoring `prd.md` and `architecture.md`, a brownfield discovery phase is required. Run `/sds:brownfield-scan` to initiate a guided discovery session that produces `brownfield-notes.md`.

Discovery findings must include:

1. **Dependency inventory** — all systems, services, and data stores this change touches, with documented behavior or explicit "UNKNOWN" markers
2. **Implicit contract inventory** — undocumented behaviors other systems rely on that this change could break
3. **Risk surface map** — identified failure modes introduced by legacy system state
4. **Unknown inventory** — explicit list of things that are unknown and why they remain unknown

An unknown inventory with honest "UNKNOWN" markers is better than a dependency map that hides uncertainty behind false confidence.

---

## Validation

Validation at brownfield tier produces **warnings**. Warnings do not block promotion.

Checklist items (in addition to standard):
- [ ] `brownfield-notes.md` exists with a Dependency Inventory section
- [ ] `brownfield-notes.md` contains an Unknown Inventory section (may be empty if all unknowns resolved)
- [ ] `architecture.md` reflects brownfield discovery findings (not just greenfield assumptions)
- [ ] `risk.md` or equivalent section exists with at least one identified failure mode per external dependency

---

## Promotion

Promoting to `specs/` from brownfield tier:
1. Brownfield discovery must be complete (`brownfield-notes.md` reviewed and accepted)
2. Run `/sds:traceability-check` — warnings at this tier
3. Run `/sds:extract-library-parts` — extraction report is informational

---

## Tier Exit Criteria

Exit brownfield tier and move to **governed** when any of the following apply:
- Change is in a regulated domain
- Legacy system carries compliance exposure
- Rollback of the change requires coordinated action across multiple systems
- Change involves irreversible data mutations
