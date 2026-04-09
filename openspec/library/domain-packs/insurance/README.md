# Domain Pack: Insurance

**Status:** Planned — Phase 6 (not yet implemented)

This domain pack will provide reusable parts for insurance domain systems, including:

- Capability patterns for policy issuance, claims adjudication, and underwriting workflows
- Requirement snippets for regulatory compliance (state/federal), coverage validation, and fraud detection gates
- Control snippets for adjuster authority limits, STP (straight-through processing) thresholds, and audit requirements
- Scenario snippets covering claims denial paths, rescission procedures, and catastrophe event handling
- Evidence snippets for claims decisions, regulatory filings, and reserve adequacy attestations

## Planned Contents

```
insurance/
├── capabilities/          # Insurance-specific capability extensions
├── patterns/
│   ├── claims-adjudication/
│   ├── policy-issuance/
│   └── underwriting/
├── snippets/
│   ├── requirement-snippets.md
│   ├── control-snippets.md
│   └── scenario-snippets.md
└── registry.yaml
```

## Dependencies

Builds on primitives: `human_approval_gate`, `audit_log`, `external_api_call`,
`reversible_mutation`, `escalation_policy`.

Regulatory context: state insurance department filing requirements, NAIC model laws,
and applicable federal requirements (ACA, ERISA) are captured as `traceability_overrides`
in governed-tier changes using this pack.
