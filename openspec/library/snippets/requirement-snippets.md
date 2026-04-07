# Requirement Snippets

Parameterized requirement blocks for common patterns. Copy into `prd.md` and substitute `{{VARIABLE}}` placeholders. Record any deviations from the source in `traceability.md` under `library_deviations`.

---

## Human Approval Required

```markdown
<requirement id="{{REQ_ID}}" library_source="requirement-snippets:human-approval-required">
The system SHALL require explicit human approval from a {{APPROVER_ROLE}} before executing
any action with risk_level of {{RISK_THRESHOLD}} or higher.
The approval request SHALL include: the proposed action, the requesting actor, the risk
classification, and a machine-readable action_proposal hash.
No execution SHALL proceed without a valid approval_token bound to the action_proposal hash.
</requirement>
```

**Variables:** `REQ_ID`, `APPROVER_ROLE` (e.g., "senior engineer", "compliance officer"), `RISK_THRESHOLD` (medium | high | critical)

---

## Audit Trail for All State Changes

```markdown
<requirement id="{{REQ_ID}}" library_source="requirement-snippets:audit-trail-state-changes">
The system SHALL emit an immutable audit record for every {{STATE_CATEGORY}} state change.
Each record SHALL include: actor identity, action type, affected resource, before-state hash,
after-state hash, and ISO8601 timestamp.
Audit records SHALL be retained for a minimum of {{RETENTION_DAYS}} days.
</requirement>
```

**Variables:** `REQ_ID`, `STATE_CATEGORY` (e.g., "user account", "policy configuration"), `RETENTION_DAYS`

---

## Cost Threshold Enforcement

```markdown
<requirement id="{{REQ_ID}}" library_source="requirement-snippets:cost-threshold-enforcement">
The system SHALL block execution of any action whose estimated cost exceeds {{COST_THRESHOLD}}
{{CURRENCY}} per {{MEASUREMENT_UNIT}}.
When an action is blocked by the cost gate, the system SHALL notify {{NOTIFICATION_TARGET}}
with the estimated cost and the action that was blocked.
</requirement>
```

**Variables:** `REQ_ID`, `COST_THRESHOLD`, `CURRENCY`, `MEASUREMENT_UNIT`, `NOTIFICATION_TARGET`

---

## Scope Isolation

```markdown
<requirement id="{{REQ_ID}}" library_source="requirement-snippets:scope-isolation">
The system SHALL restrict agent actions to the declared allowed_actions set.
The system SHALL restrict agent resource access to the declared allowed_resources set.
Any action or resource access outside these sets SHALL be blocked and logged.
The agent SHALL NOT access resources belonging to tenants other than {{TENANT_SCOPE}}.
</requirement>
```

**Variables:** `REQ_ID`, `TENANT_SCOPE` (e.g., "the invoking tenant", "the explicitly authorized tenant list")

---

## Idempotent Retry on Failure

```markdown
<requirement id="{{REQ_ID}}" library_source="requirement-snippets:idempotent-retry">
The system SHALL automatically retry failed {{OPERATION_TYPE}} operations up to {{MAX_RETRIES}}
times with {{RETRY_DELAY_MS}}ms initial delay and {{BACKOFF_MULTIPLIER}}x exponential backoff.
Retry SHALL only be attempted when the target operation is confirmed idempotent.
The system SHALL NOT retry operations that are external and non-idempotent without explicit approval.
</requirement>
```

**Variables:** `REQ_ID`, `OPERATION_TYPE`, `MAX_RETRIES`, `RETRY_DELAY_MS`, `BACKOFF_MULTIPLIER`

---

## Rollback Guarantee

```markdown
<requirement id="{{REQ_ID}}" library_source="requirement-snippets:rollback-guarantee">
The system SHALL guarantee rollback of any {{MUTATION_TYPE}} mutation within {{ROLLBACK_WINDOW_MS}}ms
of initial execution.
Before executing the mutation, the system SHALL capture current state sufficient for rollback.
If rollback is triggered, the system SHALL restore prior state and emit an audit record of the
rollback event.
</requirement>
```

**Variables:** `REQ_ID`, `MUTATION_TYPE`, `ROLLBACK_WINDOW_MS`
