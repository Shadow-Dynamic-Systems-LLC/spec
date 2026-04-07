# Pattern: Agent Routing

**ID:** `agent_routing`  
**Version:** 1.0.0  
**Status:** active  
**Domain tags:** orchestration, agent, governance

---

## Intent

Route an agent's action request to the appropriate handler based on action type, risk level, and scope — with mandatory scope enforcement and cost gating before any external routing occurs.

## Capability Composition

```yaml
requires_before:
  - scope_boundary   # Validate action is in-scope before routing
  - cost_gate        # Block if estimated cost exceeds threshold
requires_after:
  - audit_log        # Record routing decision and outcome
```

Conditionally add `human_approval_gate` for routes that cross trust boundaries.

## Routing Decision Tree

```
Action Request
  └── scope_boundary: in scope?
        ├── NO  → block + log
        └── YES → cost_gate: under threshold?
                    ├── NO  → block + notify + log
                    └── YES → route to handler
                                ├── internal (no approval needed)
                                └── external → human_approval_gate
```

## When to Use

- Multi-agent orchestration where different agents handle different action types
- Systems where external vs. internal routing must be enforced
- Any agent that can take both low-risk automated actions and high-risk gated actions

## Key Variables

| Variable | Description | Default |
|---|---|---|
| `routing_table` | Map of action_type → handler | — |
| `external_action_types` | Action types requiring approval gate | — |
| `cost_threshold` | Max cost before blocking | — |
| `default_route` | Handler for unrecognized action types | `reject` |

## Evidence Produced

- `scope_violation_log` — if scope check fails
- `cost_gate_decision_record` — on every evaluation
- `audit_log_entry` — on routing decision

## Reusable Parts

- `control-snippets:scope-boundary`
- `control-snippets:cost-threshold-enforcement`
- `control-snippets:no-external-without-approval`
- `scenario-snippets:scope-boundary-blocked`
- `scenario-snippets:cost-gate-blocked`
