# Control Snippets

Parameterized control blocks for `controls.md`. Copy and substitute `{{VARIABLE}}` placeholders. Each control must specify `enforcement_level`, `evidence_type`, and `evidence_produced_by`.

---

## Human Approval Required Before External Action

```markdown
<control id="{{CTL_ID}}" enforcement_level="hard"
          evidence_type="approval_token"
          evidence_produced_by="human_approval_gate"
          library_source="control-snippets:human-approval-before-external">
No action with risk_level >= {{RISK_THRESHOLD}} SHALL be executed without a valid
approval_token issued by the human_approval_gate capability.
The approval_token MUST be cryptographically bound to the action_proposal hash.
Escalation path: if no approver responds within {{ESCALATION_TIMEOUT_MINUTES}} minutes,
escalate to {{ESCALATION_ROLE}} via {{ESCALATION_MECHANISM}}.
</control>
```

**Variables:** `CTL_ID`, `RISK_THRESHOLD`, `ESCALATION_TIMEOUT_MINUTES`, `ESCALATION_ROLE`, `ESCALATION_MECHANISM`

---

## Audit Log on Every State Change

```markdown
<control id="{{CTL_ID}}" enforcement_level="hard"
          evidence_type="audit_log_entry"
          evidence_produced_by="audit_log"
          library_source="control-snippets:audit-log-state-changes">
Every {{STATE_CATEGORY}} state change MUST produce an immutable audit record before
the change is committed. A state change without an audit record is a control violation.
Exception: read-only operations are excluded.
</control>
```

**Variables:** `CTL_ID`, `STATE_CATEGORY`

---

## Cost Threshold Enforcement

```markdown
<control id="{{CTL_ID}}" enforcement_level="hard"
          evidence_type="cost_gate_decision_record"
          evidence_produced_by="cost_gate"
          library_source="control-snippets:cost-threshold">
Execution SHALL be blocked when estimated cost exceeds {{COST_THRESHOLD}} {{CURRENCY}}.
The cost gate decision (allowed or blocked) MUST be recorded before execution proceeds.
No override of a blocked cost gate decision is permitted without explicit escalation through
the escalation_policy capability.
</control>
```

**Variables:** `CTL_ID`, `COST_THRESHOLD`, `CURRENCY`

---

## Scope Boundary Enforcement

```markdown
<control id="{{CTL_ID}}" enforcement_level="hard"
          evidence_type="scope_violation_log"
          evidence_produced_by="scope_boundary"
          library_source="control-snippets:scope-boundary">
Agent actions MUST be restricted to the declared allowed_actions set.
Agent resource access MUST be restricted to the declared allowed_resources set.
Any attempt to act outside declared scope MUST be blocked and logged before any
partial execution occurs. Cross-tenant access is {{CROSS_TENANT_POLICY}}.
</control>
```

**Variables:** `CTL_ID`, `CROSS_TENANT_POLICY` (e.g., "prohibited", "permitted only for explicitly authorized tenant pairs")

---

## No External Call Without Approval Gate

```markdown
<control id="{{CTL_ID}}" enforcement_level="hard"
          evidence_type="approval_token"
          evidence_produced_by="human_approval_gate"
          library_source="control-snippets:no-external-without-approval">
No capability with effects.external == true SHALL be invoked unless human_approval_gate
is composed in the requires_before position and has produced a valid approval_token.
This control applies to all external_api_call invocations and any capability
where effects.external == true regardless of risk_level.
</control>
```

**Variables:** `CTL_ID`

---

## Retry Only on Idempotent Operations

```markdown
<control id="{{CTL_ID}}" enforcement_level="hard"
          evidence_type="retry_attempt_log"
          evidence_produced_by="idempotent_retry"
          library_source="control-snippets:retry-idempotent-only">
Automatic retry via idempotent_retry MUST NOT be applied to operations where
effects.idempotent == false.
For external operations, retry MUST NOT be attempted without explicit approval unless
effects.idempotent == true AND effects.external == false.
All retry attempts MUST be logged with attempt number, delay, and outcome.
</control>
```

**Variables:** `CTL_ID`
