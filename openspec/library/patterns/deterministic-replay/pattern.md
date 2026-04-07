# Pattern: Deterministic Replay

**ID:** `deterministic_replay`  
**Version:** 1.0.0  
**Status:** active  
**Domain tags:** audit, governance, reproducibility

---

## Intent

Record a capability execution with sufficient fidelity that it can be replayed to produce the same output from the same inputs. Enables post-hoc audit verification, incident investigation, and governance attestation without re-running live actions.

## Capability Composition

```yaml
requires_before:
  - audit_log         # Record inputs, model version, and execution context before run
requires_after:
  - audit_log         # Record outputs and replay hash after run
```

## Replay Record Structure

A replay record must capture:

1. **Identity** — change ID, invocation ID, timestamp
2. **Inputs** — full input payload (serialized), input hash
3. **Context** — model version or function version, capability version, active controls
4. **Outputs** — full output payload (serialized), output hash
5. **Verification** — replay hash = `hash(input_hash + capability_version + output_hash)`

```
Execution
  ├── BEFORE: audit_log(inputs, context)  →  input_hash
  ├── RUN: capability executes
  └── AFTER: audit_log(outputs)          →  output_hash
                                         →  replay_hash = H(input_hash ‖ version ‖ output_hash)
```

## Replay Verification

```
Audit Request
  └── retrieve replay_record by invocation_id
        └── re-run capability(inputs, pinned_version)
              └── compare output_hash
                    ├── MATCH   → verified + log
                    └── MISMATCH → drift_detected + flag for review
```

## When to Use

- Governed-tier capability executions requiring post-hoc auditability
- Any action that crosses a compliance boundary where evidence of correct execution is required
- Incident investigation: replay a past invocation to reproduce and diagnose unexpected output

## When NOT to Use

- Capabilities with externally non-deterministic side effects (e.g., live API calls that mutate state)
- High-frequency low-risk paths where replay overhead is operationally unacceptable

## Key Variables

| Variable | Description | Default |
|---|---|---|
| `replay_store` | Backend where replay records are persisted | — |
| `pinned_version_strategy` | How to resolve the version used at time of execution | `explicit_tag` |
| `hash_algorithm` | Hash function for input/output hashing | `sha256` |
| `retention_period_days` | How long replay records are retained | `365` |

## Evidence Produced

- `replay_record` — full serialized input + output + hashes, per invocation
- `audit_log_entry` — on both the original execution and any subsequent replay verification
- `drift_report` — if replay output does not match original output hash

## Compose With

- `audit_log` — required before and after (see composition above)
- `human_in_the_loop` — replay provides the audit trail backing an approval decision
- `memory_handling` — when memory state is part of the reproducible context, include it in the replay record

## Conflicts With

- `auto_execute` on non-deterministic paths — replay cannot verify outputs of inherently non-deterministic executions

## Reusable Parts

- `requirement-snippets:deterministic-execution-required`
- `scenario-snippets:replay-verification-happy-path`
- `scenario-snippets:replay-drift-detected`
- `control-snippets:replay-record-required`
- `evidence-snippets:replay-record-artifact`
- `evidence-snippets:drift-report-artifact`
