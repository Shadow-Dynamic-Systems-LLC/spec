# SDS-Spec Principles

These principles govern how SDS-Spec is designed, extended, and applied.

---

## 1. Governance as Capability Expansion

Governance is not only constraint — it is the mechanism by which new safe action space becomes reachable. A correctly constrained system can do things an unconstrained system cannot safely attempt. Every control applied must be accompanied by a statement of what it enables, not only what it prevents.

## 2. Spec as Source of Truth

The specification is the authoritative record of system intent. Code, configuration, and documentation are derived artifacts. When spec and implementation diverge, the spec wins — the implementation is wrong until proven otherwise.

## 3. Build Artifacts Are Not Authored

`capability_surface.md`, `traceability.md`, and `CAPABILITIES.md` are computed outputs. Manual edits are prohibited and will be overwritten on the next tool run. Authoring these files by hand produces false assurance — the system appears compliant while the underlying linkage graph is unmaintained.

## 4. Evidence Is Produced, Not Claimed

An assertion that a control was honored is not evidence. Evidence is a produced artifact — a log, hash, test output, or signed record — that proves the control held. Specs must identify the form of evidence required, not merely state the requirement.

## 5. Simulation Before Execution

In regulated domains, post-hoc analysis on production systems is expensive, slow, and legally fraught. Pre-execution simulation discovers over-constrained dead zones and unsafe escape paths while they are still cheap to fix. Governed-tier changes must simulate before approval.

## 6. Reuse Is Enforced at Promotion Time

Reusable patterns do not populate the library through good intentions. Without a forcing function, patterns are authored inline in changes, shipped, and never extracted. Library extraction is a visible step at governed-tier promotion — not a separate maintenance pass that will never happen.

## 7. Separation of Design-Time and Runtime

SDS-Spec is the design-time control plane. It declares future integration points with Lighthouse execution envelopes at runtime, but the binding is a separate concern. Confusing design-time specification with runtime enforcement leads to unimplemented guarantees being treated as implemented ones.

## 8. Tier Determines Rigor, Not Role

Workflow tier (lean, standard, brownfield, governed) determines required artifacts and validation severity. Any engineer may author any tier. Tier selection reflects change risk and scope — not seniority or organizational level.

## 9. Minimal Upstream Conflict Surface

SDS additions live in `library/`, `workflows/`, `doctrine/`, new schema files, and new per-change artifact files. Core OpenSpec directories (`specs/`, `changes/`) and source files are modified only when strictly necessary. Upstream merges must remain low-friction.

## 10. The Review Pipeline Is Itself a Capability

The AI persona review workflow (Analyst, PM, Architect, Governor, Verifier) is expressible as a capability composition in `capability.yaml` and is subject to the same drift detection and simulation as any other governed capability. The spec system applies to itself.
