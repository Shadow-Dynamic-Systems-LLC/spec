# Pattern: Memory Handling

**ID:** `memory_handling`  
**Version:** 1.0.0  
**Status:** active  
**Domain tags:** agent, memory, state-management

---

## Intent

Manage agent working memory safely across invocation boundaries — reading prior context, writing new observations, and enforcing scope so that memory reads and writes are bounded to the agent's authorized domain.

## Capability Composition

```yaml
requires_before:
  - scope_boundary    # Validate memory read/write is within authorized domain
  - audit_log         # Record what was read from memory before acting on it
requires_after:
  - audit_log         # Record what was written to memory
```

## Memory Lifecycle

```
Invocation Start
  └── scope_boundary: memory domain authorized?
        ├── NO  → block + log
        └── YES → read_memory(scope)
                    └── context_assembled
                          └── [agent executes]
                                └── write_memory(observations, scope)
                                      └── audit_log (write record)
```

## When to Use

- Multi-turn agent interactions where prior context must be retrieved
- Agents that produce persistent observations (decisions, findings, summaries)
- Systems where memory access must be scoped and auditable (regulated domains)

## When NOT to Use

- Stateless single-invocation agents with no cross-turn context requirements
- Agents where any form of persistence would violate isolation requirements

## Key Variables

| Variable | Description | Default |
|---|---|---|
| `memory_backend` | Storage backend (vector DB, key-value, episodic log) | — |
| `read_scope` | Authorized namespaces for memory reads | — |
| `write_scope` | Authorized namespaces for memory writes | — |
| `max_context_tokens` | Token budget for assembled memory context | `4096` |
| `retention_policy` | How long observations are retained before expiry | — |

## Evidence Produced

- `audit_log_entry` — on every memory read (what was retrieved and from which scope)
- `audit_log_entry` — on every memory write (what was stored, scope, timestamp)
- `scope_violation_log` — if read or write attempts an unauthorized namespace

## Compose With

- `scope_boundary` — required before any read or write (see composition above)
- `audit_log` — required before and after (see composition above)
- `deterministic_replay` — pair when memory-informed decisions must be replayable for audit

## Conflicts With

- Unbounded memory writes without `write_scope` enforcement — violates containment

## Reusable Parts

- `requirement-snippets:memory-scope-required`
- `scenario-snippets:memory-read-authorized`
- `scenario-snippets:memory-write-authorized`
- `scenario-snippets:memory-scope-violation-blocked`
- `control-snippets:scope-boundary`
- `evidence-snippets:memory-access-audit-record`
