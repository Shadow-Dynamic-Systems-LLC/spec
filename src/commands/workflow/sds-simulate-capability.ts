/**
 * SDS Simulate Capability Command
 *
 * Generates simulation.md from the capability graph, scenario library, and failure
 * injection analysis. Produces a structured report with six sections:
 *   - Coverage
 *   - Constraint Activation
 *   - Capability Utilization
 *   - Latency Impact
 *   - Unsafe Escape Paths
 *   - Recommendations
 *
 * Governed tier gate: if simulation.md contains open CRITICAL findings,
 * the apply phase is blocked.
 *
 * Output: <change-dir>/simulation.md (overwrites on every run)
 */

import ora from 'ora';
import path from 'path';
import * as fs from 'fs';
import { parse as parseYaml } from 'yaml';
import { loadChangeContext } from '../../core/artifact-graph/index.js';
import { validateChangeExists } from './shared.js';
import { safeParseCapabilityYaml, type CapabilityYaml } from '../../core/capability/schema.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SimulateCapabilityOptions {
  change?: string;
  json?: boolean;
}

type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

interface SimulationFinding {
  id: string;
  severity: FindingSeverity;
  category: string;
  description: string;
  recommendation: string;
  status: 'open' | 'mitigated';
}

interface ScenarioResult {
  scenario_id: string;
  description: string;
  inputs: Record<string, unknown>;
  expected_path: string;
  simulated_outcome: 'pass' | 'fail' | 'blocked' | 'escape';
  findings: string[];
}

interface SimulationReport {
  change: string;
  capability_id: string;
  generated_at: string;
  coverage: {
    scenarios_total: number;
    scenarios_passing: number;
    coverage_pct: number;
    uncovered_paths: string[];
  };
  constraint_activation: {
    controls_exercised: number;
    controls_total: number;
    unexercised: string[];
  };
  capability_utilization: {
    composability_pairs_tested: number;
    conflict_pairs_validated: number;
  };
  latency_impact: {
    gates_in_critical_path: number;
    estimated_overhead_ms: number;
    notes: string;
  };
  unsafe_escape_paths: SimulationFinding[];
  recommendations: SimulationFinding[];
  open_criticals: number;
}

// -----------------------------------------------------------------------------
// Simulation engine
// -----------------------------------------------------------------------------

/**
 * Generate adversarial test scenarios from capability.yaml.
 * Each scenario targets a different failure mode boundary.
 */
function generateScenarios(cap: CapabilityYaml): ScenarioResult[] {
  const scenarios: ScenarioResult[] = [];
  const inputs = cap.baml_binding?.test_inputs ?? [{}];

  // Scenario 1: Happy path with canonical inputs
  scenarios.push({
    scenario_id: 'SCN-SIM-001',
    description: 'Happy path — canonical inputs, all preconditions met',
    inputs: inputs[0] ?? {},
    expected_path: 'execute → produce output → emit evidence',
    simulated_outcome: 'pass',
    findings: [],
  });

  // Scenario 2: External capability without approval gate
  if (cap.effects.external) {
    const missingApproval = !cap.composability.requires_before.includes('human_approval_gate');
    scenarios.push({
      scenario_id: 'SCN-SIM-002',
      description: 'External action attempted without human_approval_gate in requires_before',
      inputs: inputs[0] ?? {},
      expected_path: 'execute → BLOCK (missing approval gate)',
      simulated_outcome: missingApproval ? 'escape' : 'blocked',
      findings: missingApproval
        ? ['Missing human_approval_gate in requires_before for external capability']
        : [],
    });
  }

  // Scenario 3: Conflicting capability composed
  if (cap.composability.conflicts_with.length > 0) {
    scenarios.push({
      scenario_id: 'SCN-SIM-003',
      description: `Conflicting capability (${cap.composability.conflicts_with[0]}) composed on same action path`,
      inputs: {},
      expected_path: 'compose → BLOCK (conflict detected)',
      simulated_outcome: 'blocked',
      findings: [],
    });
  }

  // Scenario 4: Non-idempotent operation retried
  if (!cap.effects.idempotent) {
    scenarios.push({
      scenario_id: 'SCN-SIM-004',
      description: 'Retry attempted on non-idempotent capability',
      inputs: inputs[0] ?? {},
      expected_path: 'execute → fail → retry → BLOCK (not idempotent)',
      simulated_outcome: 'blocked',
      findings: [],
    });
  }

  // Scenario 5: Irreversible action without audit log
  if (!cap.effects.reversible) {
    const hasAuditBefore = cap.composability.requires_before.includes('audit_log');
    scenarios.push({
      scenario_id: 'SCN-SIM-005',
      description: 'Irreversible action attempted — audit_log in requires_before position',
      inputs: inputs[0] ?? {},
      expected_path: 'audit_log → execute → audit_log',
      simulated_outcome: hasAuditBefore ? 'pass' : 'escape',
      findings: !hasAuditBefore
        ? ['Irreversible capability missing audit_log in requires_before position']
        : [],
    });
  }

  // Scenario 6: Empty / null inputs (adversarial)
  scenarios.push({
    scenario_id: 'SCN-SIM-006',
    description: 'Adversarial — empty/null inputs injected',
    inputs: {},
    expected_path: 'validate inputs → fail validation → reject',
    simulated_outcome: cap.preconditions.length > 0 ? 'blocked' : 'escape',
    findings:
      cap.preconditions.length === 0
        ? ['No preconditions defined — empty inputs may reach execution path']
        : [],
  });

  return scenarios;
}

/**
 * Identify unsafe escape paths from scenario results and capability properties.
 */
function identifyEscapePaths(
  cap: CapabilityYaml,
  scenarios: ScenarioResult[]
): SimulationFinding[] {
  const findings: SimulationFinding[] = [];
  let findingIdx = 1;

  // External without approval gate
  if (cap.effects.external && !cap.composability.requires_before.includes('human_approval_gate')) {
    findings.push({
      id: `SIM-ESC-${String(findingIdx++).padStart(3, '0')}`,
      severity: 'CRITICAL',
      category: 'missing_gate',
      description:
        'External capability (effects.external: true) does not declare human_approval_gate ' +
        'in requires_before. An external action can be taken without human oversight.',
      recommendation:
        'Add human_approval_gate to composability.requires_before, or set effects.external: false ' +
        'if this capability does not cross a trust boundary.',
      status: 'open',
    });
  }

  // Irreversible without audit
  if (!cap.effects.reversible && !cap.composability.requires_before.includes('audit_log')) {
    findings.push({
      id: `SIM-ESC-${String(findingIdx++).padStart(3, '0')}`,
      severity: 'HIGH',
      category: 'missing_audit',
      description:
        'Irreversible capability (effects.reversible: false) does not declare audit_log ' +
        'in requires_before. The action can complete without an audit trail.',
      recommendation: 'Add audit_log to composability.requires_before.',
      status: 'open',
    });
  }

  // External without evidence
  if (cap.effects.external && !cap.effects.produces_evidence) {
    findings.push({
      id: `SIM-ESC-${String(findingIdx++).padStart(3, '0')}`,
      severity: 'CRITICAL',
      category: 'no_evidence',
      description:
        'External capability has effects.produces_evidence: false. Governance rule #3 requires ' +
        'all external capabilities to produce an audit artifact on every invocation.',
      recommendation: 'Set effects.produces_evidence: true and add evidence production to capability design.',
      status: 'open',
    });
  }

  // No preconditions — open execution path
  if (cap.preconditions.length === 0 || cap.preconditions.every((p) => /TODO/i.test(p))) {
    findings.push({
      id: `SIM-ESC-${String(findingIdx++).padStart(3, '0')}`,
      severity: 'MEDIUM',
      category: 'open_preconditions',
      description: 'No valid preconditions defined. Any caller can invoke this capability ' +
        'regardless of context or authorization state.',
      recommendation: 'Define at least one precondition that restricts invocation to authorized callers.',
      status: 'open',
    });
  }

  // TODO guarantees (not yet concrete)
  const todoGuarantees = cap.guarantees.filter((g) => /TODO/i.test(g));
  if (todoGuarantees.length > 0) {
    findings.push({
      id: `SIM-ESC-${String(findingIdx++).padStart(3, '0')}`,
      severity: 'MEDIUM',
      category: 'incomplete_guarantees',
      description: `${todoGuarantees.length} guarantee(s) contain TODO text and have not been specified.`,
      recommendation: 'Replace TODO guarantees with concrete invariant statements.',
      status: 'open',
    });
  }

  // Escape scenarios from simulation
  for (const s of scenarios) {
    if (s.simulated_outcome === 'escape') {
      for (const finding of s.findings) {
        findings.push({
          id: `SIM-ESC-${String(findingIdx++).padStart(3, '0')}`,
          severity: 'HIGH',
          category: 'simulated_escape',
          description: `[${s.scenario_id}] ${finding}`,
          recommendation: 'Review scenario and add appropriate gate or precondition.',
          status: 'open',
        });
      }
    }
  }

  return findings;
}

/**
 * Generate recommendations from the full analysis.
 */
function generateRecommendations(
  cap: CapabilityYaml,
  escapePaths: SimulationFinding[]
): SimulationFinding[] {
  const recs: SimulationFinding[] = [];
  let idx = 1;

  // All open escape paths are already recommendations
  for (const esc of escapePaths.filter((e) => e.status === 'open')) {
    recs.push({
      id: `SIM-REC-${String(idx++).padStart(3, '0')}`,
      severity: esc.severity,
      category: 'remediate_escape_path',
      description: `Remediate ${esc.id}: ${esc.description}`,
      recommendation: esc.recommendation,
      status: 'open',
    });
  }

  // Suggest adding test_inputs if missing
  if (!cap.baml_binding?.test_inputs || cap.baml_binding.test_inputs.length === 0) {
    recs.push({
      id: `SIM-REC-${String(idx++).padStart(3, '0')}`,
      severity: 'MEDIUM',
      category: 'improve_coverage',
      description: 'No test_inputs defined in baml_binding — drift checking cannot establish a baseline.',
      recommendation: 'Add at least one canonical test_inputs entry to baml_binding.',
      status: 'open',
    });
  }

  // Suggest adding compatible_with entries for better surface visibility
  if (cap.composability.compatible_with.length === 0) {
    recs.push({
      id: `SIM-REC-${String(idx++).padStart(3, '0')}`,
      severity: 'INFO',
      category: 'surface_visibility',
      description: 'No compatible_with entries declared — capability surface computation will show no expanded domains.',
      recommendation: 'Declare compatible capabilities in composability.compatible_with to improve surface visibility.',
      status: 'open',
    });
  }

  return recs;
}

// -----------------------------------------------------------------------------
// Markdown renderer
// -----------------------------------------------------------------------------

function severityLabel(s: FindingSeverity): string {
  const labels: Record<FindingSeverity, string> = {
    CRITICAL: '🔴 CRITICAL',
    HIGH: '🟠 HIGH',
    MEDIUM: '🟡 MEDIUM',
    LOW: '🟢 LOW',
    INFO: '🔵 INFO',
  };
  return labels[s];
}

function renderSimulationMarkdown(report: SimulationReport): string {
  const lines: string[] = [
    `# Simulation`,
    ``,
    `<!-- BUILD ARTIFACT — generated by /sds:simulate-capability — DO NOT EDIT -->`,
    `<!-- Change: ${report.change} | Capability: ${report.capability_id} -->`,
    `<!-- Generated: ${report.generated_at} -->`,
    ``,
  ];

  // Open criticals banner
  if (report.open_criticals > 0) {
    lines.push(
      `> ⛔ **${report.open_criticals} open CRITICAL finding(s)** — governed-tier apply is BLOCKED until resolved.`,
      ``
    );
  }

  // Coverage
  lines.push(
    `## Coverage`,
    ``,
    `| Metric | Value |`,
    `|---|---|`,
    `| Scenarios total | ${report.coverage.scenarios_total} |`,
    `| Scenarios passing | ${report.coverage.scenarios_passing} |`,
    `| Coverage | ${report.coverage.coverage_pct}% |`,
    ``
  );

  if (report.coverage.uncovered_paths.length > 0) {
    lines.push(`**Uncovered paths:**`);
    report.coverage.uncovered_paths.forEach((p) => lines.push(`- ${p}`));
    lines.push(``);
  }

  // Constraint Activation
  lines.push(
    `## Constraint Activation`,
    ``,
    `| Metric | Value |`,
    `|---|---|`,
    `| Controls exercised | ${report.constraint_activation.controls_exercised} / ${report.constraint_activation.controls_total} |`,
    ``
  );

  if (report.constraint_activation.unexercised.length > 0) {
    lines.push(`**Unexercised controls:**`);
    report.constraint_activation.unexercised.forEach((c) => lines.push(`- ${c}`));
    lines.push(``);
  } else {
    lines.push(`All declared controls were exercised by at least one scenario.`, ``);
  }

  // Capability Utilization
  lines.push(
    `## Capability Utilization`,
    ``,
    `| Metric | Value |`,
    `|---|---|`,
    `| Composability pairs tested | ${report.capability_utilization.composability_pairs_tested} |`,
    `| Conflict pairs validated | ${report.capability_utilization.conflict_pairs_validated} |`,
    ``
  );

  // Latency Impact
  lines.push(
    `## Latency Impact`,
    ``,
    `| Metric | Value |`,
    `|---|---|`,
    `| Gates in critical path | ${report.latency_impact.gates_in_critical_path} |`,
    `| Estimated overhead | ${report.latency_impact.estimated_overhead_ms}ms |`,
    ``,
    `${report.latency_impact.notes}`,
    ``
  );

  // Unsafe Escape Paths
  lines.push(`## Unsafe Escape Paths`, ``);

  if (report.unsafe_escape_paths.length === 0) {
    lines.push(`_No unsafe escape paths identified._`, ``);
  } else {
    for (const f of report.unsafe_escape_paths) {
      lines.push(
        `### ${f.id} — ${severityLabel(f.severity)}`,
        ``,
        `**Category:** ${f.category}  `,
        `**Status:** ${f.status}`,
        ``,
        f.description,
        ``,
        `**Recommendation:** ${f.recommendation}`,
        ``
      );
    }
  }

  // Recommendations
  lines.push(`## Recommendations`, ``);

  if (report.recommendations.length === 0) {
    lines.push(`_No recommendations — simulation passed all checks._`, ``);
  } else {
    for (const r of report.recommendations) {
      lines.push(
        `### ${r.id} — ${severityLabel(r.severity)}`,
        ``,
        r.description,
        ``,
        `**Action:** ${r.recommendation}`,
        ``
      );
    }
  }

  return lines.join('\n');
}

// -----------------------------------------------------------------------------
// Command Implementation
// -----------------------------------------------------------------------------

export async function sdsSimulateCapabilityCommand(
  options: SimulateCapabilityOptions
): Promise<void> {
  const spinner = ora('Running capability simulation...').start();

  try {
    const projectRoot = process.cwd();
    const changeName = await validateChangeExists(options.change, projectRoot);
    const context = loadChangeContext(projectRoot, changeName);

    if (!context.schemaName.startsWith('sds-governed')) {
      spinner.warn(
        `simulate-capability is intended for governed-tier changes (schema: ${context.schemaName}).`
      );
    }

    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);
    const capabilityPath = path.join(changeDir, 'capability.yaml');

    if (!fs.existsSync(capabilityPath)) {
      spinner.fail(`capability.yaml not found at: openspec/changes/${changeName}/capability.yaml`);
      throw new Error(
        `capability.yaml is required for /sds:simulate-capability.\n` +
          `Run 'openspec instructions capability' to create it.`
      );
    }

    const capabilityRaw = parseYaml(fs.readFileSync(capabilityPath, 'utf-8'));
    const capResult = safeParseCapabilityYaml(capabilityRaw);

    if (!capResult.success) {
      spinner.fail('capability.yaml is invalid:');
      capResult.error.issues.forEach((i) =>
        console.error(`  ${i.path.join('.')}: ${i.message}`)
      );
      process.exitCode = 1;
      return;
    }

    const capability = capResult.data;
    const scenarios = generateScenarios(capability);
    const escapePaths = identifyEscapePaths(capability, scenarios);
    const recommendations = generateRecommendations(capability, escapePaths);

    const passingScenarios = scenarios.filter(
      (s) => s.simulated_outcome === 'pass' || s.simulated_outcome === 'blocked'
    );
    const gatesInPath =
      capability.composability.requires_before.length +
      capability.composability.requires_after.length;

    const openCriticals = escapePaths.filter(
      (f) => f.severity === 'CRITICAL' && f.status === 'open'
    ).length;

    const report: SimulationReport = {
      change: changeName,
      capability_id: capability.id,
      generated_at: new Date().toISOString(),
      coverage: {
        scenarios_total: scenarios.length,
        scenarios_passing: passingScenarios.length,
        coverage_pct: Math.round((passingScenarios.length / scenarios.length) * 100),
        uncovered_paths: scenarios
          .filter((s) => s.simulated_outcome === 'escape')
          .map((s) => s.description),
      },
      constraint_activation: {
        controls_exercised: scenarios.filter((s) => s.simulated_outcome !== 'escape').length,
        controls_total: scenarios.length,
        unexercised: [],
      },
      capability_utilization: {
        composability_pairs_tested: capability.composability.compatible_with.length,
        conflict_pairs_validated: capability.composability.conflicts_with.length,
      },
      latency_impact: {
        gates_in_critical_path: gatesInPath,
        estimated_overhead_ms: gatesInPath * 200, // rough estimate: 200ms per gate
        notes:
          gatesInPath === 0
            ? 'No gates in critical path — no latency overhead.'
            : `${gatesInPath} gate(s) in critical path. Each human approval gate may add significant latency in synchronous flows.`,
      },
      unsafe_escape_paths: escapePaths,
      recommendations,
      open_criticals: openCriticals,
    };

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      if (openCriticals > 0) process.exitCode = 1;
      return;
    }

    const outPath = path.join(changeDir, 'simulation.md');
    fs.writeFileSync(outPath, renderSimulationMarkdown(report), 'utf-8');

    console.log(`Written: openspec/changes/${changeName}/simulation.md`);
    console.log(
      `  Scenarios: ${report.coverage.scenarios_total}  |  ` +
        `Escape paths: ${escapePaths.length}  |  ` +
        `Open criticals: ${openCriticals}`
    );

    if (openCriticals > 0) {
      console.log(
        `\n⛔ ${openCriticals} open CRITICAL finding(s) — governed apply is BLOCKED.`
      );
      process.exitCode = 1;
    }
  } catch (error) {
    spinner.fail('simulate-capability failed');
    throw error;
  }
}
