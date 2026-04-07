# Control Validation Checklist

**Role:** Governor  
**Used in:** `sds-governed` tier  
**Artifact:** `controls.md`, `risk.md`

This checklist guides the Governor role review pass. The Governor reviews `controls.md` and `risk.md` in a context-isolated invocation — the Governor receives only: `prd.md`, `architecture.md`, `capability.yaml`, `controls.md`, `risk.md`, and this checklist. Not the full conversation history.

---

## Controls Completeness

- [ ] Every action that crosses a trust boundary has at least one `<control>` covering it
- [ ] Every capability with `effects.external: true` has a corresponding control
- [ ] Every capability with `effects.reversible: false` has a corresponding control
- [ ] Every capability with `effects.produces_evidence: false` has a review — is this intentional?
- [ ] Each `<control>` specifies `enforcement_level`: `hard` | `soft` | `advisory`
- [ ] Each `<control>` specifies `evidence_type`: what form of evidence satisfies it
- [ ] Each `<control>` specifies `evidence_produced_by`: which capability or tool produces the evidence
- [ ] No two controls with the same `enforcement_level` govern the exact same condition at the same scope — overlapping controls at different enforcement levels are acceptable when intentional and documented

## Policy Boundary Integrity

- [ ] All allowed behaviors are derivable from the capability surface — nothing is implicitly permitted
- [ ] All disallowed behaviors are explicitly stated, not implied by absence
- [ ] Escalation triggers specify: condition, target authority, and escalation mechanism
- [ ] Exception handling paths are documented for cases where a control cannot be satisfied
- [ ] Controls do not contradict each other (a behavior cannot be simultaneously required and prohibited)

## Composability Conflict Check

- [ ] `capability.yaml` composability graph is consistent with `controls.md` policy rules
- [ ] No capability listed in `composability.compatible_with` violates any `<control>`
- [ ] No capability listed in `composability.conflicts_with` is used in the same composition
- [ ] `requires_before` and `requires_after` orderings are consistent with control preconditions
- [ ] `human_approval_gate` (or equivalent) is composed before any `external: true` capability where required by controls

## Risk Coverage

- [ ] At least one `<risk>` exists for each external capability dependency
- [ ] Each `<risk>` specifies severity, trigger, mitigation, and residual
- [ ] Failure injection scenarios in `risk.md` cover: network partition, timeout, malformed input, adversarial actor
- [ ] Rollback conditions are specified and realistic — rollback plan does not assume unavailable state
- [ ] Residual risk items have identified owners and explicit acceptance records

## Precondition Verification

- [ ] All preconditions in `capability.yaml` are verifiable at invocation time — not just at design time
- [ ] Preconditions that depend on runtime state are enforceable by the capability or an upstream gate
- [ ] No precondition is circular (A requires B, B requires A)

## Governor Sign-Off

- [ ] All CRITICAL items above are satisfied
- [ ] Findings are recorded with severity and recommended action
- [ ] Review artifact is timestamped with: role=Governor, artifacts reviewed, checklist items evaluated, pass/fail
