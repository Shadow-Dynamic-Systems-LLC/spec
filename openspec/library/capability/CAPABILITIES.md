# SDS Primitive Capability Reference

<!-- BUILD ARTIFACT — generated from library/capability/registry.yaml -->
<!-- DO NOT EDIT — regenerate with /sds:status or a future /sds:generate-capabilities-md command -->
<!-- Last generated: 2026-04-07 -->

This table lists all primitive capabilities in the SDS library. Each ID links to the relevant pattern
where one exists. For full variable specs, preconditions, and composition notes, consult `registry.yaml`.

| ID | Name | Type | Domain Tags | Version | Status |
|---|---|---|---|---|---|
| `human_approval_gate` | Human Approval Gate | capability | governance, human-in-the-loop, regulated | 1.0.0 | active |
| `audit_log` | Audit Log | capability | governance, compliance, regulated | 1.0.0 | active |
| `idempotent_retry` | Idempotent Retry | capability | reliability, orchestration | 1.0.0 | active |
| `external_api_call` | External API Call | capability | integration, governance | 1.0.0 | active |
| `escalation_policy` | Escalation Policy | capability | governance, human-in-the-loop, regulated | 1.0.0 | active |
| `memory_snapshot` | Memory Snapshot | capability | reliability, orchestration, agent | 1.0.0 | active |
| `deterministic_replay` | Deterministic Replay | capability | reliability, debugging, agent | 1.0.0 | active |
| `reversible_mutation` | Reversible Mutation | capability | data, reliability, governance | 1.0.0 | active |
| `cost_gate` | Cost Gate | capability | governance, cost-control, agent | 1.0.0 | active |
| `scope_boundary` | Scope Boundary | capability | governance, security, agent | 1.0.0 | active |

## Summary by Domain Tag

| Domain Tag | Capabilities |
|---|---|
| governance | `human_approval_gate`, `audit_log`, `external_api_call`, `escalation_policy`, `reversible_mutation`, `cost_gate`, `scope_boundary` |
| regulated | `human_approval_gate`, `audit_log`, `escalation_policy` |
| human-in-the-loop | `human_approval_gate`, `escalation_policy` |
| compliance | `audit_log` |
| agent | `memory_snapshot`, `deterministic_replay`, `cost_gate`, `scope_boundary` |
| reliability | `idempotent_retry`, `memory_snapshot`, `deterministic_replay`, `reversible_mutation` |
| orchestration | `idempotent_retry`, `memory_snapshot` |
| integration | `external_api_call` |
| security | `scope_boundary` |
| cost-control | `cost_gate` |
| debugging | `deterministic_replay` |
| data | `reversible_mutation` |

## Known Dependency Graph

```
external_api_call
  └── requires: audit_log, human_approval_gate

human_approval_gate
  └── requires: audit_log

escalation_policy
  └── requires: audit_log

reversible_mutation
  └── requires: audit_log

deterministic_replay
  └── requires: memory_snapshot

idempotent_retry    — no dependencies
audit_log           — no dependencies
memory_snapshot     — no dependencies
cost_gate           — no dependencies
scope_boundary      — no dependencies
```
