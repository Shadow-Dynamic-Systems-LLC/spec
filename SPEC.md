# SDS-Spec: Shadow Dynamic Systems Specification Framework

**Version:** 0.2.0-alpha  
**Upstream:** OpenSpec (private fork)  
**Maintained by:** Shadow Dynamic Systems  
**Status:** Internal Draft  
**License:** Proprietary — Shadow Dynamic Systems

---

## Overview

SDS-Spec is a private fork of OpenSpec that extends spec-driven development into a full capability-engineering system. Where stock OpenSpec provides lightweight spec tracking and change management, SDS-Spec adds capability composition, derived capability surfaces, pre-execution simulation, AI-native spec formatting, and governance-grade audit artifacts suited to regulated industries.

The system is organized around a core principle: governance should not only constrain — it should make explicit what new safe action space becomes available when constraints are applied correctly. The spec system therefore answers two questions simultaneously:

- **Can this system act safely?** (enforcement)
- **What new systems become possible because it is safe?** (capability expansion)

SDS-Spec is designed to be the design-time control plane. It declares future integration points with Lighthouse execution envelopes at runtime, but the binding between design-time specification and runtime enforcement is a separate concern addressed in the Lighthouse integration roadmap (see [Future Lighthouse Binding](#future-lighthouse-binding)).

---

## Upstream Relationship

SDS-Spec maintains a clean fork relationship with OpenSpec. The following upstream behaviors are preserved without modification:

| OpenSpec concept | Status in SDS-Spec |
|---|---|
| Capability-based spec organization | Preserved |
| Change-scoped proposals and spec deltas | Preserved |
| Human approval before implementation | Preserved |
| Specs as persistent repository context | Preserved |
| `specs/` and `changes/` top-level split | Preserved |
| Minimal, repo-native workflow | Preserved as default tier |

Upstream updates to OpenSpec should be evaluated for merge compatibility. SDS additions live in new directories (`library/`, `workflows/`, `doctrine/`) and new per-change artifact files so merge conflicts with upstream are minimal.

---

## Repository Structure

```
openspec/
├── project.md
├── doctrine/
│   ├── sds-principles.md
│   ├── governance-rules.md
│   ├── naming-conventions.md
│   └── evidence-standards.md
├── specs/
│   └── <capability-name>/
│       ├── spec.md
│       ├── design-notes.md
│       ├── controls.md
│       ├── evidence.md
│       └── reusable-parts/
│           ├── scenarios/
│           ├── requirements/
│           └── patterns/
├── changes/
│   └── <change-id>/
│       ├── proposal.md
│       ├── brief.md
│       ├── prd.md
│       ├── architecture.md
│       ├── design.md
│       ├── tasks.md
│       ├── risk.md
│       ├── validation.md
│       ├── traceability.md
│       ├── capability.yaml
│       ├── capability_surface.md
│       ├── simulation.md
│       └── specs/
│           └── <capability-name>/
│               └── spec.md
├── library/
│   ├── capability/
│   │   ├── registry.yaml
│   │   └── CAPABILITIES.md   ← auto-generated, do not edit
│   ├── patterns/
│   │   ├── auth/
│   │   ├── human-in-the-loop/
│   │   ├── approval-workflow/
│   │   ├── agent-routing/
│   │   ├── memory-handling/
│   │   └── deterministic-replay/
│   ├── snippets/
│   │   ├── requirement-snippets.md
│   │   ├── scenario-snippets.md
│   │   ├── control-snippets.md
│   │   └── evidence-snippets.md
│   ├── templates/
│   │   ├── proposal.template.md
│   │   ├── prd.template.md
│   │   ├── architecture.template.md
│   │   ├── risk.template.md
│   │   ├── validation.template.md
│   │   └── traceability.template.md
│   ├── checklists/
│   │   ├── brownfield-checklist.md
│   │   ├── regulated-release-checklist.md
│   │   └── control-validation-checklist.md
│   └── archived-parts/
└── workflows/
    ├── lean-change.md
    ├── standard-change.md
    ├── brownfield-change.md
    └── governed-change.md
```

---

## Workflow Tiers

SDS-Spec uses progressive disclosure via workflow tiers. Tiers determine which artifact files are required for a change to be approved. A change may be promoted from a lower tier to a higher tier at any point.

| Tier | When to use | Required artifacts |
|---|---|---|
| **Lean** | Small, low-risk, local changes | `proposal.md`, `tasks.md`, delta `spec.md` |
| **Standard** | Feature-level work | Lean + `brief.md`, `prd.md`, `architecture.md`, `design.md` |
| **Brownfield** | Changes to undocumented or legacy systems | Standard + brownfield discovery notes, dependency and risk mapping |
| **Governed** | Regulated, high-risk, or cross-cutting changes | Brownfield + `controls.md`, `risk.md`, `validation.md`, `traceability.md`, `capability.yaml`, `capability_surface.md`, `simulation.md` |

Validation for lean and standard tiers produces **warnings**. Validation for governed tier produces **errors** that block promotion.

### CLI Commands

```
/sds:new-change <name> [--tier lean|standard|brownfield|governed]
/sds:propose
/sds:full-plan
/sds:brownfield-scan
/sds:compose-from-library
/sds:compute-surface
/sds:simulate-capability
/sds:governance-review
/sds:traceability-check
/sds:check-drift
/sds:promote-change
/sds:promote-to-governed
/sds:extract-library-parts
/sds:status
```

`/sds:new-change` scaffolds the correct artifact set for the specified tier with all files pre-populated from `library/templates/` and TODO markers on required fields.

`/sds:compute-surface` is non-interactive. It reads the `capability.yaml` and `controls.md` for a change and writes `capability_surface.md` automatically. This file is a **build artifact** and must never be edited by hand.

`/sds:check-drift` hashes current BAML function execution outputs and compares them against guarantees declared in `capability.yaml`, reporting any divergence.

`/sds:extract-library-parts` scans a change being promoted and identifies candidate reusable parts for extraction into `library/`. See [Library Extraction](#library-extraction).

---

## Artifact Definitions

Each artifact has strict scope boundaries. Overlapping content between artifacts is a spec quality failure.

### `proposal.md`
*Why this change exists and why it should happen now.* Contains problem statement, motivation, business or compliance context, and relationship to roadmap. Does not contain requirements, architecture decisions, or implementation details.

### `brief.md`
*Stakeholder, problem, and environment context.* Adapted from BMAD Analyst role output. Contains stakeholder map, workflow context, brownfield system state, and problem framing. Does not contain requirements or acceptance criteria.

### `prd.md`
*Outcomes, requirements, and acceptance criteria.* Adapted from BMAD PM role output. Contains user outcomes, functional requirements, non-functional requirements, constraints, scope boundaries, and measurable success metrics. Does not contain architecture decisions.

### `architecture.md`
*System topology, interfaces, and tradeoffs.* Adapted from BMAD Architect role output. Contains system boundaries, component interfaces, dependency graph, trust zones, control points, and key architectural decisions. Does not contain requirements.

### `design.md`
*Technical decisions specific to this change.* Contains implementation approach, chosen patterns, rejected alternatives, and rationale. Scoped to this change only.

### `tasks.md`
*Executable implementation checklist.* Ordered, checkable list of implementation steps. Contains no analysis or justification.

### `controls.md`
*Policy rules, risk boundaries, and escalation triggers.* Contains allowed and disallowed behaviors, constraint statements, required approvals, escalation conditions, and exception handling rules. Does not contain validation procedures.

### `risk.md`
*Failure modes, misuse paths, and rollback assumptions.* Contains identified failure scenarios, adversarial inputs, compliance exposure, rollback conditions, and residual risk acceptance criteria.

### `validation.md`
*What must be verified before approval, before merge, and before release.* Contains pre-approval checks, pre-merge checks, and pre-release checks organized as executable checklists. References evidence requirements from `controls.md`.

### `traceability.md`
*Artifact-to-artifact and requirement-to-evidence linkage map.* Build artifact — generated by `/sds:traceability-check` from the XML-tagged content in all other change artifacts. Do not author manually. See [Traceability as Build Artifact](#traceability-as-build-artifact).

### `capability.yaml`
*Typed capability definition.* See Capability Type System section below. This is a machine-readable artifact consumed by SDS tooling.

### `capability_surface.md`
*Derived safe action space.* Auto-generated by `/sds:compute-surface`. Do not edit manually. See Capability Surface section below.

### `simulation.md`
*Pre-execution behavioral analysis.* Generated by `/sds:simulate-capability`. See Simulation section below.

---

## Traceability as Build Artifact

### Design Intent

Manually authored traceability is the artifact most likely to be abandoned under time pressure or degrade into pro-forma boilerplate. Because all structured content in SDS-Spec artifacts uses XML-tagged blocks with stable identifiers, the traceability linkage graph can be computed rather than hand-maintained.

### Mechanism

`/sds:traceability-check` performs two functions:

1. **Generation.** Scans all artifacts in the change directory for XML-tagged blocks (`<requirement>`, `<control>`, `<risk>`, `<evidence>`, `<scenario>`, `<decision>`, `<capability>`), resolves cross-references by `id` attribute, and writes the complete linkage map to `traceability.md`.

2. **Validation.** Verifies completeness of the linkage graph:
   - Every `<requirement>` has at least one linked `<scenario>` or `<evidence>` reference.
   - Every `<control>` links to at least one `<requirement>` and one `<evidence>`.
   - Every `<decision>` in `architecture.md` links to at least one `<requirement>`.
   - Library part provenance and deviations are recorded under `library_deviations`.

Validation failures produce warnings at standard tier and errors at governed tier.

### Manual Override

In cases where a traceability link cannot be expressed through XML tag cross-references (e.g., an external compliance mapping), a `traceability_overrides` section may be appended to `traceability.md`. This section is preserved across regeneration runs. All other content in the file is overwritten on each run.

---

## Capability Type System

### Design Intent

The capability type system transforms the `library/` from a reuse mechanism into a typed capability graph with composability guarantees. Each capability is a composable unit with known inputs, outputs, preconditions, effects, and compatibility constraints. This enables SDS-Spec to answer: *"What new systems can I construct safely from these primitives?"*

### `capability.yaml` Schema

```yaml
id: <string>                     # Unique identifier, kebab-case
kind: capability
version: <semver>
description: <string>

inputs:
  - <field_name>: <type>         # Named typed inputs

outputs:
  - <field_name>: <type>         # Named typed outputs

preconditions:
  - <constraint expression>      # Must all be satisfied at invocation

effects:
  reversible: <bool>             # Can the effect be undone?
  external: <bool>               # Does this cross a trust boundary?
  idempotent: <bool>             # Safe to retry without side effects?
  produces_evidence: <bool>      # Does this emit an audit artifact?

composability:
  compatible_with:
    - <capability_id>
  conflicts_with:
    - <capability_id>
  requires_before:
    - <capability_id>
  requires_after:
    - <capability_id>

guarantees:
  - <invariant statement>        # What is always true after execution

baml_binding:
  function: <FunctionName>       # Target BAML function name
  auto_generate: <bool>          # If true, /sds:compile-baml generates stub

tags:
  - <domain_tag>                 # e.g., governance, insurance, orchestration
```

### Primitive Capabilities

The following primitives are defined in `library/capability/registry.yaml` and cover the majority of SDS use cases. New primitives must be reviewed before addition.

| ID | Description | External | Reversible | Idempotent |
|---|---|---|---|---|
| `human_approval_gate` | Requires explicit human approval before action | Yes | No | No |
| `audit_log` | Emits a cryptographically bound audit record | No | No | Yes |
| `idempotent_retry` | Safe retry under failure injection | No | Yes | Yes |
| `external_api_call` | Crosses trust boundary to external service | Yes | No | No |
| `escalation_policy` | Routes to higher authority on condition | Yes | No | No |
| `memory_snapshot` | Captures agent memory state at point in time | No | Yes | Yes |
| `deterministic_replay` | Replays execution from snapshot | No | Yes | Yes |
| `reversible_mutation` | Mutates state with rollback guarantee | No | Yes | No |
| `cost_gate` | Blocks execution above cost threshold | No | No | Yes |
| `scope_boundary` | Enforces agent action scope limits | No | No | Yes |

### Canonical Example

```yaml
id: human_approval_gate
kind: capability
version: 1.0.0
description: >
  Requires explicit human approval before a consequential or
  irreversible action is executed. Produces an auditable decision
  artifact regardless of approval outcome.

inputs:
  - action_proposal: ActionProposal
  - actor_role: Role

outputs:
  - approval_token: ApprovalToken

preconditions:
  - actor_role in authorized_roles
  - action_proposal.risk_level in [medium, high, critical]

effects:
  reversible: false
  external: true
  idempotent: false
  produces_evidence: true

composability:
  compatible_with:
    - audit_log
    - escalation_policy
    - deterministic_replay
  conflicts_with:
    - auto_execute
  requires_before:
    - audit_log

guarantees:
  - Produces auditable decision artifact on both approve and reject paths
  - Approval token is cryptographically bound to action_proposal hash
  - No execution proceeds without valid approval_token

baml_binding:
  function: HumanApprovalGate
  auto_generate: true

tags:
  - governance
  - human-in-the-loop
  - regulated
```

### BAML Compilation

When `baml_binding.auto_generate: true`, running `/sds:compile-baml` generates a BAML function stub from the capability inputs and outputs. This ensures the spec is the source of truth for the code interface and eliminates double-entry between spec authorship and orchestration code.

```baml
// Auto-generated by /sds:compile-baml from capability.yaml
// DO NOT EDIT — regenerate from capability.yaml

function HumanApprovalGate(
  action_proposal: ActionProposal,
  actor_role: Role
) -> ApprovalToken {
  // Implementation required
}
```

---

## Capability Surface

### Design Intent

`capability_surface.md` answers the question: *"Given current controls, what new actions are now safely possible?"* This makes capability expansion visible and computable, converting governance from "what you cannot do" into "what you can now do safely that you could not before."

### Generation

`capability_surface.md` is always generated by `/sds:compute-surface`. The tool reads:

- `controls.md` — active constraints and preconditions
- `capability.yaml` — composability graph and effects
- `risk.md` — failure mode boundaries
- `library/capability/registry.yaml` — available primitive set

It then computes:

- Newly safe compositions given current controls
- Expanded execution domains unlocked by specific guarantees
- Conditional capabilities that exist only under certain constraints
- Dead zones — capability areas that are over-constrained and unreachable

### Example Output

```markdown
## Derived Capability Surface
_Generated: 2026-04-06T21:43:00Z by /sds:compute-surface_
_Change: CHG-0042-orchestration-approval-layer_

### Newly Enabled Capabilities
- Safe autonomous retry enabled (bounded by idempotency_control + cost_gate)
- Multi-agent coordination permitted within audit scope
- External API execution permitted under human_approval_gate pattern
- Reversible memory mutation permitted with deterministic_replay guarantee

### Expanded Execution Domains
- Orchestrator may invoke external services in regulated context if
  human_approval_gate + audit_log are composed and both produce_evidence: true
- Agent scope may extend to cross-tenant context under scope_boundary primitive

### Conditional Capabilities
- Autonomous action permitted for risk_level: low actions only
- Retry without approval permitted if idempotent: true and external: false

### Dead Zones (Over-Constrained)
- WARNING: auto_execute conflicts with human_approval_gate in current composition
  Action: review whether auto_execute should be removed or scoped to low-risk only
- WARNING: 3 action paths blocked by redundant controls (controls.md lines 14, 22, 31)
  Recommend: consolidate into single scope_boundary primitive
```

---

## Simulation

### Design Intent

Static validation proves spec correctness; simulation proves system performance under constraint. Without simulation, over-constrained areas, unsafe escape paths, and suppressed behavior remain invisible until production.

### `simulation.md` Contents

`simulation.md` is generated by `/sds:simulate-capability` and records:

- **Scenario coverage** — which capability paths were exercised
- **Constraint activation frequency** — how often each control was triggered
- **Capability utilization** — what percentage of the derived capability surface was exercised
- **Dead zones** — action paths that are unreachable under current constraints
- **Failure injection results** — behavior under adversarial and boundary inputs
- **Unsafe escape paths** — paths where execution proceeds without required evidence coupling
- **Latency impact** — estimated overhead introduced by composed capabilities

### Example Output

```markdown
## Simulation Results
_Generated: 2026-04-06T21:50:00Z by /sds:simulate-capability_
_Spec: CHG-0042 | Capability: human_approval_gate_

### Coverage
- 12 of 15 action paths exercised (80%)
- 3 paths untested: require adversarial actor_role fixtures

### Constraint Activation
- human_approval_gate: activated on 100% of medium/high risk paths ✓
- cost_gate: activated on 23% of paths (expected: ~30%) — review threshold
- audit_log: NOT activated on 2 rejection paths — CRITICAL GAP

### Capability Utilization
- 61% of derived capability surface exercised
- 82% of valid action paths proceed successfully
- Retry logic expands completion rate by 41% under failure injection ✓

### Latency Impact
- Approval gate introduces 2.3× latency on external paths
- Acceptable: external paths are not latency-sensitive per NFRs

### Unsafe Escape Paths
- CRITICAL: One path allows unbounded escalation without evidence coupling
  Path: auto_retry → external_api_call (missing audit_log in composition)
  Action required before governed tier approval

### Recommendations
- Bind audit_log to all rejection paths in capability.yaml requires_before
- Add adversarial actor_role test fixtures to scenario library
- Review cost_gate threshold: expected 30% activation, observed 23%
```

---

## Reusable Parts Library

### Design Intent

The library stores typed, parameterized, versioned spec components rather than static text blobs. Each part is instantiated with variables into a change-local draft, deviations from the source are recorded, and provenance is tracked in `traceability.md`.

### Library Structure

```
library/
├── capability/
│   ├── registry.yaml          # Canonical capability registry
│   └── CAPABILITIES.md        # Auto-generated quick-reference
├── patterns/
│   ├── auth/
│   ├── human-in-the-loop/
│   ├── approval-workflow/
│   ├── agent-routing/
│   ├── memory-handling/
│   └── deterministic-replay/
├── snippets/
│   ├── requirement-snippets.md
│   ├── scenario-snippets.md
│   ├── control-snippets.md
│   └── evidence-snippets.md
├── templates/
│   ├── proposal.template.md
│   ├── prd.template.md
│   ├── architecture.template.md
│   ├── risk.template.md
│   ├── validation.template.md
│   └── traceability.template.md
├── checklists/
│   ├── brownfield-checklist.md
│   ├── regulated-release-checklist.md
│   └── control-validation-checklist.md
└── archived-parts/
```

### `registry.yaml` Schema

Each entry in the capability registry follows this schema:

```yaml
- id: <string>
  name: <string>
  type: capability | requirement | scenario | control | architecture-decision | evidence-pattern
  description: <string>
  domain_tags:
    - <tag>
  variables:
    - name: <variable_name>
      type: <type>
      description: <string>
      default: <value or null>
  preconditions:
    - <condition>
  known_dependencies:
    - <capability_id>
  last_used_in:
    - <change_id>
  version: <semver>
  status: active | deprecated | experimental
  deprecated_by: <id or null>
```

### Composition Workflow

When authoring a change, the composition workflow proceeds as follows:

1. Search `library/registry.yaml` for matching parts by domain and capability type.
2. Pull candidate parts and review variables and preconditions.
3. Run `/sds:compose-from-library <part-id> [--vars key=value]` to instantiate variables into a change-local draft.
4. Record any deviations from the source part in `traceability.md` under `library_deviations`.
5. Promoting the change into `specs/` requires a stale-library check — if the source part has been updated since instantiation, a warning is issued.

Parts that are superseded should be moved to `archived-parts/` with a `deprecated_by` reference, not deleted, so change history remains intact.

### Library Extraction

Cold-start libraries do not populate themselves. To prevent the library from remaining empty while all reusable patterns are inlined in change artifacts, SDS-Spec enforces extraction visibility during change promotion.

`/sds:extract-library-parts` runs automatically as part of `/sds:promote-change` and performs the following:

1. Scans the change's artifacts for XML-tagged blocks that match existing library part types (`<requirement>`, `<control>`, `<scenario>`, `<evidence>`, `<capability>`).
2. Identifies candidate parts that are not already instantiated from an existing library entry (i.e., have no `library_source` provenance in `traceability.md`).
3. For each candidate, evaluates reuse potential based on parameterizability (are there concrete values that could be replaced with variables?) and domain tag overlap with existing library entries.
4. Produces an extraction report listing candidates with recommended variable bindings.

At **lean and standard tiers**, the extraction report is informational — it is logged but does not block promotion. At **governed tier**, the extraction report must be explicitly acknowledged (accepted or deferred with justification) before promotion completes. Deferred extractions are tracked as library debt in `library/extraction-backlog.yaml`.

This ensures that reusable patterns are surfaced as a natural byproduct of the change workflow rather than requiring a separate maintenance pass that will never happen.

---

## AI-Native Spec Format

### Design Intent

Both human engineers and AI coding agents (Cursor, RooCode, Lighthouse orchestration pipelines) read these specs. Prose-only markdown is ambiguous to AI parsers. SDS-Spec embeds XML tags within markdown so that humans read headings and prose while agents parse tag-bounded blocks with precision.

### Format Convention

Every structured block in a spec file is wrapped in a typed XML tag. The tag `id` attribute matches the capability or requirement identifier in `registry.yaml`.

```markdown
## Human Approval Gate

Requires explicit human approval before a consequential or irreversible action.

<capability id="human_approval_gate">
<preconditions>
- actor_role in authorized_roles
- action_proposal.risk_level in [medium, high, critical]
</preconditions>
<effects>
- reversible: false
- external: true
- produces_evidence: true
</effects>
<guarantees>
- Produces auditable decision artifact on approve and reject paths
- No execution proceeds without valid approval_token
</guarantees>
</capability>
```

### Supported Tag Types

| Tag | Used in | Purpose |
|---|---|---|
| `<capability>` | `capability.yaml`, spec files | Typed capability block |
| `<requirement>` | `prd.md` | Parseable requirement with ID |
| `<control>` | `controls.md` | Policy rule with enforcement level |
| `<risk>` | `risk.md` | Failure mode with severity and mitigation |
| `<evidence>` | `validation.md`, `traceability.md` | Evidence requirement with type |
| `<scenario>` | spec files, library snippets | Executable scenario with inputs and expected outcome |
| `<decision>` | `architecture.md` | Architecture decision with rationale and alternatives |

This format ensures that structured governance artifacts are parsed correctly when injected into agent context windows, consistent with effective context engineering practices for AI agents.

---

## SDS Review Roles

### Design Intent

BMAD's agent model is adapted as AI persona review lanes, not human staffing requirements. Each role is an independent AI review pass with a scoped system prompt, constrained to its artifact ownership and corresponding checklist in `library/checklists/`.

### Role Definitions

| Role | Responsibility | Artifact ownership |
|---|---|---|
| **Analyst** | Context, problem framing, brownfield discovery | `brief.md` |
| **PM** | Requirements, scope, acceptance outcomes | `prd.md` |
| **Architect** | Topology, interfaces, dependencies, tradeoffs | `architecture.md` |
| **Governor** | Controls, policy boundaries, exception handling | `controls.md`, `risk.md` |
| **Verifier** | Testability, evidence, traceability, simulation review | `validation.md`, `traceability.md`, `simulation.md` |

### Context Isolation

For lean and standard tiers, roles may be collapsed into fewer review passes or executed within shared context. For governed tier, Governor and Verifier roles **must** be executed as independent invocations with scoped context — each pass receives only its owned artifacts and the artifacts it depends on, not the full conversation history of prior review passes. This prevents the separation-of-concerns guarantee from becoming cosmetic.

### Evidence of Review

Each AI persona review pass must produce a signed, timestamped review artifact logged to Memoria. The review artifact records: the role, the artifacts reviewed, the checklist items evaluated, pass/fail determination, and any findings. This closes the evidence loop — the review process itself is auditable, not just the artifacts it evaluates.

### Human Approval Boundary

AI persona reviews are advisory and produce evidence. Final approval authority for governed-tier changes rests with a human approver who reviews the AI-generated review artifacts and the change artifacts themselves. For lean and standard tiers, AI persona approval is sufficient unless the change is later promoted to governed tier, at which point human approval is required retroactively.

---

## Governance Rules (Hard Invariants)

The following rules are enforced by SDS tooling. They are not advisory.

1. No requirement enters a spec without at least one linked scenario or validation reference.
2. No governed-tier change is approved without complete `controls.md`, `validation.md`, `traceability.md`, `capability.yaml`, and `simulation.md`.
3. No governed-tier change is approved if `simulation.md` contains an open CRITICAL finding.
4. `capability_surface.md` must be regenerated after any modification to `capability.yaml` or `controls.md`.
5. `traceability.md` must be regenerated after any modification to tagged artifacts in the change. Manual edits outside the `traceability_overrides` section are overwritten.
6. Promoting a change into `specs/` requires a passing `/sds:traceability-check` run.
7. Promoting a change into `specs/` triggers `/sds:extract-library-parts`. At governed tier, the extraction report must be explicitly acknowledged.
8. Library parts must be versioned and moved to `archived-parts/` when deprecated — never deleted.
9. `capability_surface.md`, `traceability.md`, and `CAPABILITIES.md` are build artifacts. Manual edits are prohibited (except `traceability_overrides`) and will be overwritten on next tool run.
10. BAML function stubs generated by `/sds:compile-baml` must not be manually modified. Interface changes must be made in `capability.yaml` and recompiled.
11. `/sds:check-drift` must pass before any governed-tier change is deployed to a Lighthouse execution envelope.
12. Governed-tier AI persona reviews for Governor and Verifier roles must be context-isolated and produce signed review artifacts.

---

## Semantic Drift Detection

### Design Intent

In AI systems, code does not just break — the meaning of the system drifts away from the spec over time as prompts are modified, controls are bypassed, or execution paths change. SDS-Spec binds the capability spec to runtime behavior through drift detection.

### Mechanism

`/sds:check-drift` performs the following checks:

1. For each capability in `capability.yaml` with `baml_binding` defined, execute the current BAML function with the canonical test inputs from the capability's scenario library.
2. Hash the output and compare against the expected output hash stored in `capability.yaml` under `validation_hash`.
3. For each guarantee in `capability.yaml`, verify it holds on the actual execution output.
4. Report any divergence between declared guarantees and observed behavior as a drift violation.

Drift violations block deployment to governed Lighthouse envelopes until resolved.

### `validation_hash` Field

```yaml
# Added to capability.yaml after first verified run
validation:
  hash: sha256:<hash_of_canonical_output>
  verified_at: <ISO8601 timestamp>
  verified_by: <change_id>
```

---

## Future Lighthouse Binding

The following touchpoints are designed for future integration with Lighthouse execution envelopes at runtime. They are declared interfaces, not yet specified. The binding protocol, transport mechanism, and enforcement semantics will be defined in a separate Lighthouse integration specification.

| Touchpoint | Design-time artifact | Runtime binding |
|---|---|---|
| **Drift enforcement** | `capability.yaml` validation hashes and guarantees | Lighthouse blocks execution when drift is detected against deployed spec |
| **Capability surface consumption** | `capability_surface.md` | Lighthouse uses the derived surface to authorize or deny agent action requests at runtime |
| **Evidence routing** | `<evidence>` tags in `validation.md` and `controls.md` | Runtime evidence produced by capabilities is routed to Memoria with provenance linking back to the originating spec |
| **Review pipeline as governed capability** | Review role definitions and checklist artifacts | The AI persona review pipeline is itself expressible as a capability composition in `capability.yaml`, subject to the same drift detection and simulation — a dog-fooding integration point |
| **Simulation-to-runtime feedback** | `simulation.md` predictions | Post-deployment telemetry is compared against simulation predictions to calibrate future simulation accuracy |

Until these bindings are specified, references to "Lighthouse execution envelopes" elsewhere in this document indicate design intent, not implemented integration.

---

## Domain Packs

Domain packs are collections of pre-built capabilities, templates, patterns, and snippets for specific regulated domains. Each pack is a subdirectory under `library/` and is opt-in.

### Planned Domain Packs

| Pack | Status | Contents |
|---|---|---|
| `insurance` | Planned Phase 6 | Munich Re / Swiss Re underwriting patterns, actuarial requirement snippets, approval workflow templates for binding authority |
| `healthcare` | Planned Phase 6 | PHI handling controls, HIPAA compliance checklists, clinical decision support approval gates |
| `ai-orchestration` | Planned Phase 4 | Agent routing capabilities, memory handling patterns, cost gate primitives, scope boundary enforcement |
| `regulated-release` | Planned Phase 3 | Deployment approval gates, rollback primitives, evidence chain templates |

---

## Rollout Phases

| Phase | Scope | Deliverables |
|---|---|---|
| **Phase 1** | Fork setup and base conventions | Preserve OpenSpec model, add SDS folder structure and artifact definitions |
| **Phase 2** | BMAD planning layer | Add `brief.md`, `prd.md`, `architecture.md` templates; add review role checklists |
| **Phase 3** | Reusable parts library | `registry.yaml` schema, composition workflow, `library/` scaffold, `CAPABILITIES.md` generation, library extraction tooling |
| **Phase 4** | Capability type system | `capability.yaml` schema, primitive registry, BAML compilation, drift detection |
| **Phase 5** | Simulation and surface | `/sds:compute-surface`, `/sds:simulate-capability`, `capability_surface.md`, `simulation.md`, traceability generation |
| **Phase 6** | Domain packs | Insurance, healthcare, AI-orchestration, and regulated-release packs |

---

## Design Decisions

### Why YAML over JSON Schema for `capability.yaml`

YAML is the appropriate format for human-authored capability definitions that sit alongside markdown prose in a spec repository. JSON Schema is the appropriate choice when capabilities need runtime validation against incoming data payloads (e.g., validating an API request body or an LLM structured output). SDS-Spec uses both in the correct register:

- `capability.yaml` — human-authored capability definitions (YAML, comments supported, readable inline with markdown, type-checked by SDS tooling at CI time)
- `capability.schema.json` — runtime validation schema for capability inputs/outputs, auto-generated from `capability.yaml` by `/sds:compile-schema` for use in Lighthouse execution envelopes and LLM structured outputs

This separates authoring ergonomics (YAML) from runtime correctness guarantees (JSON Schema) rather than conflating them.

### Why capability_surface.md is a build artifact

Making the capability surface human-maintained would cause it to drift from the actual constraint graph within one sprint. Treating it as a compiled output ensures it always reflects the current state of `capability.yaml` and `controls.md`, and making it markdown (rather than JSON) keeps it readable as repo documentation without additional tooling.

### Why traceability.md is a build artifact

Manually authored traceability is the artifact most likely to be abandoned under time pressure. Because all structured content uses XML-tagged blocks with stable identifiers, traceability links can be computed from the existing artifact graph. Requiring manual transcription of data that already exists in machine-readable form creates a maintenance burden with a predictable failure mode: either the artifact is skipped, or it degrades into boilerplate that satisfies the check without carrying signal. Computing it eliminates both failure modes.

### Why simulation precedes execution (not post-hoc)

Post-hoc analysis on production systems in regulated domains is expensive, slow, and legally fraught. Pre-execution simulation discovers over-constrained dead zones and unsafe escape paths while they are still cheap to fix.

### Why library extraction is a promotion-time forcing function

Cold-start reusable libraries do not populate themselves through good intentions. Without a forcing function, reusable patterns will be authored inline in changes, shipped, and never extracted — creating invisible library debt. Making extraction a visible step in the promotion workflow (informational at lower tiers, acknowledged at governed tier) ensures the debt is tracked even when it is deferred.

---

## Glossary

| Term | Definition |
|---|---|
| **Capability** | A typed, composable unit of system behavior with known inputs, outputs, preconditions, effects, and composability constraints |
| **Capability surface** | The set of actions that are safely reachable given current constraints; the positive complement of a control set |
| **Change** | A scoped unit of work that proposes, designs, and implements modifications to one or more capabilities |
| **Control** | A policy rule that constrains allowed behavior; may be precondition, postcondition, or invariant |
| **Dead zone** | A region of the capability space that is unreachable due to over-constraint; detected by simulation |
| **Drift** | Divergence between the behavior declared in a spec and the behavior observed at runtime |
| **Evidence** | A produced artifact (log, hash, signature, test output) that proves a control or guarantee was honored |
| **Execution envelope** | The runtime context within which a Lighthouse-governed capability may execute; integration not yet specified (see Future Lighthouse Binding) |
| **Governed tier** | The highest workflow tier; required for regulated, high-risk, or cross-cutting changes |
| **Library debt** | Reusable patterns identified during promotion but deferred for extraction; tracked in `library/extraction-backlog.yaml` |
| **Library part** | A parameterized, versioned, reusable spec component stored in `library/` |
| **Primitive capability** | A base-level capability defined in `library/capability/registry.yaml`; not decomposable further |
| **Review artifact** | A signed, timestamped record of an AI persona review pass, logged to Memoria |
| **Traceability** | The computed linkage between a requirement, its architecture decision, its control, its validation, and its runtime evidence; generated as a build artifact from XML-tagged content |
