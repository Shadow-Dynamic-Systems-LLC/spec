# Phase 6: Domain Packs — Roadmap

**Status:** Planned / Stubs present  
**Depends on:** Phases 1–5 complete (all implemented as of commit 22bacce)

---

## Overview

Domain packs extend the primitive capability library with industry-specific and
use-case-specific content: capabilities, patterns, requirement snippets, control
snippets, and scenario snippets bundled for a target domain.

Four domain packs are planned. Each has a stub directory with a README. None
have content yet — this document describes what each pack should contain and
the order of implementation.

---

## Domain Packs

### 1. `ai-orchestration`

**Target users:** Teams building multi-agent systems, LLM pipelines, tool-use workflows.

**Planned contents:**

| Path | Description |
|---|---|
| `capabilities/agent_router.yaml` | Route tasks to specialized agents by capability match |
| `capabilities/tool_use_gate.yaml` | Constrain which tools an agent may invoke per context |
| `capabilities/context_isolator.yaml` | Enforce agent context boundaries (no cross-contamination) |
| `patterns/fan-out-fan-in.md` | Parallel sub-agent dispatch with result aggregation |
| `patterns/supervisor-worker.md` | Hierarchical delegation with approval gate at supervisor level |
| `patterns/chain-of-thought-audit.md` | Require CoT trace before tool use |
| `snippets/requirement-snippets.md` | Agent scope, cost ceiling, memory boundary requirements |
| `snippets/control-snippets.md` | Output validation, escape-path detection controls |
| `snippets/scenario-snippets.md` | Adversarial prompt injection, runaway cost, tool misuse |
| `registry.yaml` | Domain capability registry (extends library/capability/registry.yaml) |

**Primitive dependencies:** `scope_boundary`, `cost_gate`, `memory_snapshot`,
`deterministic_replay`, `human_approval_gate`, `audit_log`

---

### 2. `regulated-release`

**Target users:** Teams operating under change-management or release-governance requirements.

**Planned contents:**

| Path | Description |
|---|---|
| `capabilities/release_gate.yaml` | Multi-party approval gate before production promotion |
| `capabilities/rollback_trigger.yaml` | Automated rollback on signal threshold breach |
| `capabilities/compliance_evidence_pack.yaml` | Bundles evidence artifacts required for audit |
| `patterns/canary-with-gate.md` | Canary release with automatic gate evaluation |
| `patterns/blue-green-governed.md` | Blue-green with Governor sign-off before traffic shift |
| `snippets/requirement-snippets.md` | Change freeze, approval quorum, rollback window requirements |
| `snippets/control-snippets.md` | Pre-release checklist, evidence completeness controls |
| `snippets/scenario-snippets.md` | Partial rollout failure, approval expiry, evidence gap |
| `registry.yaml` | Domain capability registry |

**Primitive dependencies:** `human_approval_gate`, `audit_log`, `cost_gate`, `scope_boundary`

---

### 3. `insurance`

**Target users:** Insurance product and claims teams using AI for underwriting, triage, or pricing.

**Planned contents:**

| Path | Description |
|---|---|
| `capabilities/underwriting_assist.yaml` | AI-assisted risk scoring with human-in-the-loop gate |
| `capabilities/claims_triage.yaml` | Initial claims classification with evidence capture |
| `capabilities/regulatory_disclosure.yaml` | Required disclosure generation with version control |
| `patterns/human-in-loop-underwriting.md` | Underwriter reviews AI recommendation before bind |
| `patterns/adverse-action-notice.md` | Adverse action flow with required evidence trail |
| `snippets/requirement-snippets.md` | Explainability, bias monitoring, disclosure requirements |
| `snippets/control-snippets.md` | Output auditability, jurisdiction-specific rule controls |
| `snippets/scenario-snippets.md` | Edge-case coverage gaps, regulatory scrutiny scenarios |
| `registry.yaml` | Domain capability registry |

**Primitive dependencies:** `human_approval_gate`, `audit_log`, `scope_boundary`

---

### 4. `healthcare`

**Target users:** Healthcare teams using AI for clinical decision support, documentation, or triage.

**Planned contents:**

| Path | Description |
|---|---|
| `capabilities/clinical_decision_support.yaml` | AI recommendation with mandatory clinician review |
| `capabilities/phi_boundary.yaml` | PHI isolation — enforces no PII/PHI in LLM context |
| `capabilities/prior_auth_assist.yaml` | Prior authorization drafting with evidence attachment |
| `patterns/clinician-in-the-loop.md` | Mandatory clinician approval before acting on AI output |
| `patterns/phi-scrub-before-inference.md` | PHI redaction pipeline before any external model call |
| `snippets/requirement-snippets.md` | HIPAA compliance, consent, audit trail requirements |
| `snippets/control-snippets.md` | PHI leakage prevention, output scope controls |
| `snippets/scenario-snippets.md` | Misclassification risk, consent gap, PHI exposure |
| `registry.yaml` | Domain capability registry |

**Primitive dependencies:** `human_approval_gate`, `audit_log`, `scope_boundary`,
`phi_boundary` (new primitive, to be added to library/capability/registry.yaml)

---

## Implementation Order

1. **`ai-orchestration`** — highest demand, least regulatory complexity, builds directly
   on existing primitives with no new ones required.

2. **`regulated-release`** — complements the governed-tier workflow already in place;
   natural fit for teams already using `sds-governed` schema.

3. **`insurance`** — requires domain SME review; `regulatory_disclosure` capability
   needs jurisdiction parameterization.

4. **`healthcare`** — highest compliance burden; `phi_boundary` primitive must be added
   to `library/capability/registry.yaml` before this pack can reference it.

---

## How to Contribute a Domain Pack

1. Create `openspec/library/domain-packs/<domain>/registry.yaml` following the schema
   in `openspec/library/capability/registry.yaml`.

2. Add capabilities under `<domain>/capabilities/` using the `schemas/sds-governed/templates/capability.yaml` template.

3. Add patterns under `<domain>/patterns/` following the format in `openspec/library/patterns/`.

4. Add snippets under `<domain>/snippets/` following `openspec/library/snippets/`.

5. Run `openspec sds compile-baml --change <name>` for any capability with
   `baml_binding.auto_generate: true`.

6. Run `openspec sds check-drift --change <name> --update-hash` to establish baselines.

7. Submit a PR; the Governor role must approve domain pack additions at the governed tier.
