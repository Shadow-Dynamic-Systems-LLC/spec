# Scenario Snippets

Parameterized scenario blocks for common test cases. Copy into spec files and substitute `{{VARIABLE}}` placeholders. Link each scenario to its parent requirement using the `requirement` attribute.

---

## Approval Gate — Happy Path

```markdown
<scenario id="{{SCN_ID}}" requirement="{{REQ_ID}}" library_source="scenario-snippets:approval-gate-happy-path">
WHEN a {{ACTOR_ROLE}} submits an action_proposal with risk_level={{RISK_LEVEL}}
AND the actor_role is in authorized_roles
THEN the system presents the approval request to the designated approver
AND the approver approves the request
AND the system issues a valid approval_token bound to the action_proposal hash
AND execution proceeds with the approval_token attached
AND an audit record is emitted recording the approval decision
</scenario>
```

**Variables:** `SCN_ID`, `REQ_ID`, `ACTOR_ROLE`, `RISK_LEVEL`

---

## Approval Gate — Rejection Path

```markdown
<scenario id="{{SCN_ID}}" requirement="{{REQ_ID}}" library_source="scenario-snippets:approval-gate-rejection">
WHEN a {{ACTOR_ROLE}} submits an action_proposal with risk_level={{RISK_LEVEL}}
AND the designated approver rejects the request
THEN no approval_token is issued
AND execution does NOT proceed
AND an audit record is emitted recording the rejection decision
AND the rejection reason is returned to the requesting actor
</scenario>
```

**Variables:** `SCN_ID`, `REQ_ID`, `ACTOR_ROLE`, `RISK_LEVEL`

---

## Cost Gate — Blocked

```markdown
<scenario id="{{SCN_ID}}" requirement="{{REQ_ID}}" library_source="scenario-snippets:cost-gate-blocked">
WHEN the system evaluates an action whose estimated cost is {{ESTIMATED_COST}} {{CURRENCY}}
AND the cost_threshold is {{COST_THRESHOLD}} {{CURRENCY}}
AND {{ESTIMATED_COST}} > {{COST_THRESHOLD}}
THEN execution is blocked
AND {{NOTIFICATION_TARGET}} is notified with the estimated cost and blocked action details
AND no external calls are made
</scenario>
```

**Variables:** `SCN_ID`, `REQ_ID`, `ESTIMATED_COST`, `CURRENCY`, `COST_THRESHOLD`, `NOTIFICATION_TARGET`

---

## Scope Boundary — Out-of-Scope Action Blocked

```markdown
<scenario id="{{SCN_ID}}" requirement="{{REQ_ID}}" library_source="scenario-snippets:scope-boundary-blocked">
WHEN an agent attempts to execute action {{BLOCKED_ACTION}}
AND {{BLOCKED_ACTION}} is NOT in the allowed_actions set
THEN the action is blocked before execution
AND an audit record is emitted recording the blocked attempt, the actor, and the disallowed action
AND the agent receives an out-of-scope error with the list of allowed_actions
</scenario>
```

**Variables:** `SCN_ID`, `REQ_ID`, `BLOCKED_ACTION`

---

## Idempotent Retry — Succeeds on Retry

```markdown
<scenario id="{{SCN_ID}}" requirement="{{REQ_ID}}" library_source="scenario-snippets:idempotent-retry-success">
WHEN a {{OPERATION_TYPE}} operation fails on the first attempt with a transient error
AND the operation is idempotent
AND retry attempt 2 succeeds
THEN the system returns the successful result
AND the total attempt count is recorded (1 failure, 1 success)
AND no duplicate side effects occur
</scenario>
```

**Variables:** `SCN_ID`, `REQ_ID`, `OPERATION_TYPE`

---

## Idempotent Retry — Exhausted

```markdown
<scenario id="{{SCN_ID}}" requirement="{{REQ_ID}}" library_source="scenario-snippets:idempotent-retry-exhausted">
WHEN a {{OPERATION_TYPE}} operation fails on all {{MAX_RETRIES}} attempts
THEN the system returns a terminal failure
AND the failure reason from the final attempt is surfaced to the caller
AND all {{MAX_RETRIES}} attempts are recorded in the audit log
</scenario>
```

**Variables:** `SCN_ID`, `REQ_ID`, `OPERATION_TYPE`, `MAX_RETRIES`

---

## Rollback — Triggered on Failure

```markdown
<scenario id="{{SCN_ID}}" requirement="{{REQ_ID}}" library_source="scenario-snippets:rollback-triggered">
WHEN a {{MUTATION_TYPE}} mutation is executed
AND a failure occurs within {{ROLLBACK_WINDOW_MS}}ms of execution
AND rollback is triggered
THEN the system restores prior state to its pre-mutation value
AND an audit record is emitted recording: rollback trigger, actor, resource, restored state hash
AND the caller receives confirmation that rollback completed successfully
</scenario>
```

**Variables:** `SCN_ID`, `REQ_ID`, `MUTATION_TYPE`, `ROLLBACK_WINDOW_MS`
