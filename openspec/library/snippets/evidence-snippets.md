# Evidence Snippets

Parameterized evidence blocks for `validation.md`. Copy into the appropriate gate section and substitute `{{VARIABLE}}` placeholders. Link each evidence item to its control using the `control` attribute.

---

## Approval Token Present and Valid (Pre-Approval Gate)

```markdown
<evidence id="{{EVD_ID}}" control="{{CTL_ID}}" form="approval_token" gate="pre-approval"
           library_source="evidence-snippets:approval-token-pre-approval">
- [ ] An approval_token has been issued by human_approval_gate for this change
- [ ] The approval_token is cryptographically bound to the action_proposal hash for this change
- [ ] The approving actor held role {{APPROVER_ROLE}} at time of approval
- [ ] The approval is recorded in the audit log with ISO8601 timestamp
</evidence>
```

**Variables:** `EVD_ID`, `CTL_ID`, `APPROVER_ROLE`

---

## Traceability Check Passed (Pre-Merge Gate)

```markdown
<evidence id="{{EVD_ID}}" control="{{CTL_ID}}" form="tool_output" gate="pre-merge"
           library_source="evidence-snippets:traceability-check-pre-merge">
- [ ] `/sds:traceability-check` has been run after the last modification to any tagged artifact
- [ ] The run produced no errors (warnings acceptable at standard tier)
- [ ] `traceability.md` reflects the current state of all tagged artifacts
- [ ] The tool output timestamp is recorded: {{TRACEABILITY_RUN_TIMESTAMP}}
</evidence>
```

**Variables:** `EVD_ID`, `CTL_ID`, `TRACEABILITY_RUN_TIMESTAMP`

---

## Simulation Clear of CRITICAL Findings (Pre-Merge Gate)

```markdown
<evidence id="{{EVD_ID}}" control="{{CTL_ID}}" form="tool_output" gate="pre-merge"
           library_source="evidence-snippets:simulation-clear-pre-merge">
- [ ] `/sds:simulate-capability` has been run and produced `simulation.md`
- [ ] `simulation.md` contains no open CRITICAL findings
- [ ] All findings from prior simulation runs are resolved or have accepted mitigations in `risk.md`
- [ ] The simulation run timestamp is recorded: {{SIMULATION_RUN_TIMESTAMP}}
</evidence>
```

**Variables:** `EVD_ID`, `CTL_ID`, `SIMULATION_RUN_TIMESTAMP`

---

## Audit Log Entries Present for All State Changes (Pre-Release Gate)

```markdown
<evidence id="{{EVD_ID}}" control="{{CTL_ID}}" form="audit_log_entry" gate="pre-release"
           library_source="evidence-snippets:audit-log-entries-present">
- [ ] Audit log entries exist for all {{STATE_CATEGORY}} state changes in the test run
- [ ] Each entry includes: actor identity, action type, affected resource, timestamp
- [ ] No state changes occurred without a corresponding audit log entry
- [ ] Audit log is append-only (no deletions or modifications detected)
</evidence>
```

**Variables:** `EVD_ID`, `CTL_ID`, `STATE_CATEGORY`

---

## Scope Boundary Test Results (Pre-Release Gate)

```markdown
<evidence id="{{EVD_ID}}" control="{{CTL_ID}}" form="test_output" gate="pre-release"
           library_source="evidence-snippets:scope-boundary-test-results">
- [ ] Out-of-scope action test: action {{BLOCKED_ACTION}} was blocked before execution
- [ ] Out-of-scope resource test: access to {{BLOCKED_RESOURCE}} was blocked
- [ ] Cross-tenant access test: cross-tenant action was {{EXPECTED_CROSS_TENANT_OUTCOME}}
- [ ] All blocked attempts were logged with actor, action, and timestamp
</evidence>
```

**Variables:** `EVD_ID`, `CTL_ID`, `BLOCKED_ACTION`, `BLOCKED_RESOURCE`, `EXPECTED_CROSS_TENANT_OUTCOME`

---

## Governor Review Artifact Present (Pre-Approval Gate)

```markdown
<evidence id="{{EVD_ID}}" control="{{CTL_ID}}" form="review_artifact" gate="pre-approval"
           library_source="evidence-snippets:governor-review-artifact">
- [ ] A Governor role review artifact exists for this change
- [ ] The review artifact was produced in a context-isolated invocation
- [ ] The artifact records: role=Governor, artifacts reviewed, all checklist items with pass/fail
- [ ] The artifact determination is PASS or PASS_WITH_FINDINGS (FAIL blocks approval)
- [ ] The artifact timestamp is present: {{GOVERNOR_REVIEW_TIMESTAMP}}
</evidence>
```

**Variables:** `EVD_ID`, `CTL_ID`, `GOVERNOR_REVIEW_TIMESTAMP`

---

## Verifier Review Artifact Present (Pre-Approval Gate)

```markdown
<evidence id="{{EVD_ID}}" control="{{CTL_ID}}" form="review_artifact" gate="pre-approval"
           library_source="evidence-snippets:verifier-review-artifact">
- [ ] A Verifier role review artifact exists for this change
- [ ] The review artifact was produced in a context-isolated invocation
- [ ] The artifact records: role=Verifier, artifacts reviewed, all checklist items with pass/fail
- [ ] The artifact determination is PASS or PASS_WITH_FINDINGS (FAIL blocks approval)
- [ ] The artifact timestamp is present: {{VERIFIER_REVIEW_TIMESTAMP}}
</evidence>
```

**Variables:** `EVD_ID`, `CTL_ID`, `VERIFIER_REVIEW_TIMESTAMP`
