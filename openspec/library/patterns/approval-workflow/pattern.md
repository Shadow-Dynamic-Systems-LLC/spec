# Pattern: Approval Workflow

**ID:** `approval_workflow`  
**Version:** 1.0.0  
**Status:** active  
**Domain tags:** governance, workflow, regulated

---

## Intent

Orchestrate a multi-step approval sequence where an action proposal moves through defined stages — submission, review, decision, and execution — with an audit trail at each stage.

## Capability Composition

```yaml
requires_before:
  - audit_log            # Log the proposal submission
  - scope_boundary       # Validate action is within allowed scope before presenting
  - human_approval_gate  # Obtain approval decision
requires_after:
  - audit_log            # Log the decision and execution outcome
```

## Stages

1. **Submission** — Actor submits `ActionProposal`. `scope_boundary` validates action is in-scope. `audit_log` records submission.
2. **Review** — `human_approval_gate` presents proposal to designated approver(s).
3. **Decision** — Approver issues approve or reject. `audit_log` records decision + `approval_token`.
4. **Execution** — If approved, action executes with `approval_token` attached. `audit_log` records outcome.
5. **Escalation (conditional)** — If no decision within timeout, `escalation_policy` routes to backup.

## When to Use

- Multi-approver workflows (sequential or parallel approval)
- Actions requiring a formal decision record for compliance
- Workflows where the decision and execution are temporally separated

## Key Variables

| Variable | Description | Default |
|---|---|---|
| `approver_roles` | Ordered list of approver roles | — |
| `approval_mode` | `any_one` or `all_required` | `any_one` |
| `escalation_timeout_minutes` | Timeout before escalation | `60` |
| `proposal_expiry_hours` | When unanswered proposals expire | `24` |

## Evidence Produced

- `audit_log_entry` — at each stage transition
- `approval_token` — on approval decision

## Reusable Parts

- `requirement-snippets:human-approval-required`
- `scenario-snippets:approval-gate-happy-path`
- `scenario-snippets:approval-gate-rejection`
- `control-snippets:human-approval-before-external`
- `control-snippets:no-external-without-approval`
- `evidence-snippets:approval-token-pre-approval`
