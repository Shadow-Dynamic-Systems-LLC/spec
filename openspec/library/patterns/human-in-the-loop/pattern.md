# Pattern: Human-in-the-Loop

**ID:** `human_in_the_loop`  
**Version:** 1.0.0  
**Status:** active  
**Domain tags:** governance, human-in-the-loop, regulated

---

## Intent

Insert a mandatory human decision point before any consequential or irreversible action. Ensure the decision is auditable regardless of outcome.

## Capability Composition

```yaml
requires_before:
  - audit_log          # Record the action proposal before presenting to approver
  - human_approval_gate # Obtain explicit approval
requires_after:
  - audit_log          # Record the approval or rejection decision
```

## When to Use

- Any action with `effects.reversible: false`
- Any action with `effects.external: true` and `risk_level >= medium`
- Any action that crosses an organizational trust boundary
- Regulated domains where human oversight is a compliance requirement

## When NOT to Use

- Low-risk, fully reversible, internal-only actions
- Actions with `risk_level: low` and `effects.external: false`
- High-frequency automated paths where human latency would be operationally unacceptable (use `cost_gate` + `scope_boundary` instead)

## Key Variables

| Variable | Description | Default |
|---|---|---|
| `risk_threshold` | Minimum risk level triggering gate | `medium` |
| `approver_role` | Role authorized to approve | — |
| `escalation_timeout_minutes` | Time before escalating to backup approver | `30` |

## Evidence Produced

- `approval_token` — cryptographically bound to action_proposal hash
- `audit_log_entry` — on both approve and reject paths

## Compose With

- `escalation_policy` — when no approver responds within timeout
- `deterministic_replay` — to replay the approved action path for audit
- `audit_log` — required before and after (see composition above)

## Conflicts With

- `auto_execute` — cannot compose with auto-execute on the same action path

## Example `capability.yaml` Fragment

```yaml
composability:
  compatible_with:
    - audit_log
    - escalation_policy
    - deterministic_replay
  conflicts_with:
    - auto_execute
  requires_before:
    - audit_log
```

## Reusable Parts

- `requirement-snippets:human-approval-required`
- `scenario-snippets:approval-gate-happy-path`
- `scenario-snippets:approval-gate-rejection`
- `control-snippets:human-approval-before-external`
- `evidence-snippets:approval-token-pre-approval`
- `evidence-snippets:governor-review-artifact`
