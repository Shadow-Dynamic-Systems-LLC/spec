# Domain Pack: Healthcare

**Status:** Planned — Phase 6 (not yet implemented)

This domain pack will provide reusable parts for healthcare domain systems, including:

- Capability patterns for clinical decision support, prior authorization, and patient data access
- Requirement snippets for HIPAA compliance, PHI handling, minimum necessary standards, and consent management
- Control snippets for access logging (required by HIPAA §164.312), de-identification gates, and break-glass procedures
- Scenario snippets covering PHI breach paths, emergency access overrides, and audit response procedures
- Evidence snippets for HIPAA audit logs, BAA (Business Associate Agreement) attestations, and risk assessments

## Planned Contents

```
healthcare/
├── capabilities/          # Healthcare-specific capability extensions
├── patterns/
│   ├── phi-access/
│   ├── prior-authorization/
│   └── clinical-decision-support/
├── snippets/
│   ├── requirement-snippets.md   # HIPAA-aligned requirements
│   ├── control-snippets.md       # PHI controls, access logging
│   ├── scenario-snippets.md
│   └── evidence-snippets.md      # Audit log, BAA attestation
└── registry.yaml
```

## Dependencies

Builds on primitives: `audit_log`, `scope_boundary`, `human_approval_gate`,
`external_api_call`. All external calls must have `effects.produces_evidence: true`
per HIPAA audit requirements.

Regulatory context: HIPAA Privacy Rule (45 CFR Part 164), Security Rule,
HITECH Act, and applicable state privacy laws are captured as `traceability_overrides`
in governed-tier changes using this pack.
