# Brownfield Discovery Checklist

**Role:** Analyst  
**Used in:** `sds-brownfield` and `sds-governed` tiers  
**Artifact:** `brownfield-notes.md`

This checklist guides the Analyst role through brownfield discovery before `prd.md` is authored. Complete each section and record findings in `brownfield-notes.md`. An explicit UNKNOWN is better than a gap hidden by false confidence.

---

## Dependency Inventory

- [ ] All systems this change directly reads from are identified and named
- [ ] All systems this change directly writes to are identified and named
- [ ] All systems this change calls synchronously are identified
- [ ] All systems this change triggers asynchronously are identified
- [ ] For each dependency: behavior under normal operation is documented or marked UNKNOWN
- [ ] For each dependency: behavior under failure is documented or marked UNKNOWN
- [ ] For each dependency: ownership and change-control process is documented
- [ ] External third-party dependencies are identified and version-pinned where applicable

## Implicit Contract Inventory

- [ ] Callers of existing interfaces that could break under this change are identified
- [ ] Undocumented field usage (fields not in schema but in use) is documented
- [ ] Timing-dependent behavior (polling intervals, retry assumptions) is documented
- [ ] Data format assumptions (encoding, precision, null handling) are documented
- [ ] Each implicit contract is recorded in `brownfield-notes.md` with the dependent system named

## Risk Surface

- [ ] Legacy data with unexpected shape or range is identified
- [ ] Migration paths for in-flight requests or transactions are documented
- [ ] Shared mutable state that this change touches is identified
- [ ] Cascading failure paths from this change are described
- [ ] At least one failure mode per external dependency is recorded

## Unknown Inventory

- [ ] Every item that could not be investigated is explicitly listed as UNKNOWN
- [ ] Each UNKNOWN has an identified owner and a plan (investigate before PRD / accept and constrain / escalate)
- [ ] No UNKNOWN item has been silently omitted — if it cannot be known, it must be named

## Completeness Gate

- [ ] `brownfield-notes.md` reflects all findings above
- [ ] `brief.md` current-state section is consistent with discovery findings
- [ ] All unknowns that affect scope or risk are surfaced to the PM before `prd.md` is authored
