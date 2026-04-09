# Domain Pack: Regulated Release

**Status:** Planned — Phase 6 (not yet implemented)

This domain pack will provide reusable parts for software release processes under regulatory oversight, including:

- Capability patterns for change freeze enforcement, release gate sequencing, and rollback procedures
- Requirement snippets for pre-release validation, artifact attestation, and sign-off chains
- Control snippets for deployment window enforcement, environment segregation, and approval chains
- Scenario snippets covering hotfix paths, emergency change procedures, and rollback triggers
- Evidence snippets for release notes, deployment records, and approver attestations

## Planned Contents

```
regulated-release/
├── patterns/              # Release gate, rollback, freeze enforcement
├── snippets/
│   ├── requirement-snippets.md
│   ├── control-snippets.md
│   ├── scenario-snippets.md
│   └── evidence-snippets.md
└── checklists/
    └── pre-release-gate.md
```

## Dependencies

Builds on primitives: `human_approval_gate`, `audit_log`, `reversible_mutation`,
`escalation_policy`. Extends governed-tier validation workflow.

See `openspec/library/checklists/regulated-release-checklist.md` for the
Verifier role checklist (already implemented).
