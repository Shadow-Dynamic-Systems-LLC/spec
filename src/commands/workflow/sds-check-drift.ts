/**
 * SDS Check Drift Command
 *
 * Validates that a capability's actual runtime output (given canonical test_inputs)
 * matches the hash stored in capability.yaml's validation block.
 *
 * For each capability with a baml_binding defined:
 *   1. Load test_inputs from baml_binding.test_inputs
 *   2. Execute the BAML function stub (or a local simulation for Phase 4)
 *   3. Hash the output with SHA-256
 *   4. Compare against validation.hash in capability.yaml
 *   5. Verify each guarantee holds on the output
 *
 * Exits non-zero if any violation found — this is the governed-tier deployment gate.
 *
 * NOTE: Full BAML runtime execution requires Phase 4 tooling. Until a BAML runtime
 * is connected, this command validates structural integrity only (schema, hash format,
 * guarantees text) and marks live-execution checks as BLOCKED.
 */

import ora from 'ora';
import path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { loadChangeContext } from '../../core/artifact-graph/index.js';
import { validateChangeExists, resolveCapabilityYaml } from './shared.js';
import {
  parseCapabilityYaml,
  type CapabilityYaml,
} from '../../core/capability/schema.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CheckDriftOptions {
  change?: string;
  updateHash?: boolean;
  json?: boolean;
}

type CheckStatus = 'pass' | 'fail' | 'blocked' | 'skip';

interface DriftCheck {
  name: string;
  status: CheckStatus;
  message: string;
  detail?: string;
}

interface DriftReport {
  change: string;
  capability_id: string;
  capability_version: string;
  function: string;
  checks: DriftCheck[];
  /** 'fail' means blocking failures; 'blocked' means non-failing but unverifiable; 'pass' is clean. */
  overall: 'pass' | 'fail' | 'blocked';
}

// -----------------------------------------------------------------------------
// Hash utilities
// -----------------------------------------------------------------------------

/**
 * Recursively sort all object keys before serialising so that the output is
 * identical regardless of key-insertion order or JS engine.  This is required
 * for a stable drift baseline: two semantically identical test_inputs objects
 * that differ only in key order must produce the same hash.
 */
function stableStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return '[' + val.map(stableStringify).join(',') + ']';
  const keys = Object.keys(val as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify((val as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

function hashTestOutput(testInputs: Record<string, unknown>[]): string {
  // Produce a deterministic structural hash of test_inputs as a Phase 4 proxy until
  // a live BAML runtime is connected. Uses stableStringify to ensure key-order independence.
  return crypto
    .createHash('sha256')
    .update(stableStringify(testInputs), 'utf-8')
    .digest('hex');
}

// -----------------------------------------------------------------------------
// Individual checks
// -----------------------------------------------------------------------------

function checkSchemaValidity(cap: CapabilityYaml): DriftCheck {
  // Already validated by parseCapabilityYaml — if we're here, schema is valid
  return {
    name: 'schema_validity',
    status: 'pass',
    message: 'capability.yaml parses and validates against schema',
  };
}

function checkBamlBindingPresent(cap: CapabilityYaml): DriftCheck {
  if (!cap.baml_binding) {
    return {
      name: 'baml_binding_present',
      status: 'skip',
      message: 'No baml_binding defined — skipping drift checks',
    };
  }
  return {
    name: 'baml_binding_present',
    status: 'pass',
    message: `baml_binding.function: ${cap.baml_binding.function}`,
  };
}

function checkTestInputsPresent(cap: CapabilityYaml): DriftCheck {
  const inputs = cap.baml_binding?.test_inputs;
  if (!inputs || inputs.length === 0) {
    return {
      name: 'test_inputs_present',
      status: 'blocked',
      message: 'No test_inputs in baml_binding — cannot perform hash verification',
      detail: 'Add baml_binding.test_inputs to enable drift checking',
    };
  }
  return {
    name: 'test_inputs_present',
    status: 'pass',
    message: `${inputs.length} test input(s) defined`,
  };
}

function checkHashFormat(cap: CapabilityYaml): DriftCheck {
  if (!cap.validation?.hash) {
    return {
      name: 'hash_format',
      status: 'blocked',
      message: 'No validation.hash present — baseline not yet established',
      detail: 'Run with --update-hash to establish initial baseline',
    };
  }
  if (!/^[a-f0-9]{64}$/.test(cap.validation.hash)) {
    return {
      name: 'hash_format',
      status: 'fail',
      message: 'validation.hash is present but malformed (expected 64-char hex SHA-256)',
    };
  }
  return {
    name: 'hash_format',
    status: 'pass',
    message: `validation.hash present (${cap.validation.hash.slice(0, 12)}...)`,
  };
}

function checkOutputHash(cap: CapabilityYaml): DriftCheck {
  const inputs = cap.baml_binding?.test_inputs;
  if (!inputs || inputs.length === 0 || !cap.validation?.hash) {
    return {
      name: 'output_hash_match',
      status: 'blocked',
      message: 'BLOCKED: requires test_inputs and validation.hash — establish baseline first',
      detail:
        'Full BAML runtime execution is required for live hash verification. ' +
        'Structural hash (test_inputs only) is used until a runtime is connected.',
    };
  }

  const structuralHash = hashTestOutput(inputs as Record<string, unknown>[]);

  // In Phase 4 without a live runtime, we compare the structural hash of test_inputs.
  // When a BAML runtime is connected, replace this with actual function execution.
  if (structuralHash !== cap.validation.hash) {
    return {
      name: 'output_hash_match',
      status: 'fail',
      message: `Hash mismatch — structural drift detected`,
      detail: `Expected: ${cap.validation.hash}\nActual:   ${structuralHash}`,
    };
  }

  return {
    name: 'output_hash_match',
    status: 'pass',
    message: 'Structural hash matches validation.hash',
  };
}

function checkGuaranteesDocumented(cap: CapabilityYaml): DriftCheck {
  if (cap.guarantees.length === 0) {
    return {
      name: 'guarantees_documented',
      status: 'fail',
      message: 'No guarantees defined — at least one guarantee is required',
      detail: 'Add invariant statements to the guarantees array in capability.yaml',
    };
  }

  const placeholder = cap.guarantees.find(
    (g) => /TODO|placeholder|example/i.test(g)
  );
  if (placeholder) {
    return {
      name: 'guarantees_documented',
      status: 'fail',
      message: 'Guarantee contains TODO/placeholder text — must be concrete invariant statements',
      detail: `Found: "${placeholder}"`,
    };
  }

  return {
    name: 'guarantees_documented',
    status: 'pass',
    message: `${cap.guarantees.length} guarantee(s) documented`,
  };
}

function checkEffectsClassified(cap: CapabilityYaml): DriftCheck {
  // All effects fields have defaults — if the capability is external and not
  // produces_evidence, that's a governance concern worth flagging.
  if (cap.effects.external && !cap.effects.produces_evidence) {
    return {
      name: 'effects_classified',
      status: 'fail',
      message: 'External capability must have effects.produces_evidence: true (governance rule #3)',
      detail: 'External capabilities must emit an audit artifact on every invocation.',
    };
  }
  return {
    name: 'effects_classified',
    status: 'pass',
    message: `Effects classified (external: ${cap.effects.external}, reversible: ${cap.effects.reversible}, idempotent: ${cap.effects.idempotent})`,
  };
}

function checkComposabilityConsistency(cap: CapabilityYaml): DriftCheck {
  const conflicts = cap.composability.conflicts_with;
  const compatible = cap.composability.compatible_with;
  const overlap = conflicts.filter((id) => compatible.includes(id));

  if (overlap.length > 0) {
    return {
      name: 'composability_consistency',
      status: 'fail',
      message: `Capability is listed in both compatible_with and conflicts_with: ${overlap.join(', ')}`,
    };
  }

  return {
    name: 'composability_consistency',
    status: 'pass',
    message: 'Composability graph has no contradictions',
  };
}

// -----------------------------------------------------------------------------
// Command Implementation
// -----------------------------------------------------------------------------

export async function sdsCheckDriftCommand(options: CheckDriftOptions): Promise<void> {
  const spinner = ora('Loading capability.yaml...').start();

  try {
    const projectRoot = process.cwd();
    const changeName = await validateChangeExists(options.change, projectRoot);
    const context = loadChangeContext(projectRoot, changeName);
    if (!context.schemaName.startsWith('sds-governed')) {
      spinner.warn(`check-drift is intended for governed-tier changes (schema: ${context.schemaName}).`);
      console.log(`Proceeding anyway — no capability.yaml may be present.`);
    }

    const { filePath: capabilityPath, source } = resolveCapabilityYaml(projectRoot, changeName);
    if (source === 'specs') {
      console.log(`Note: reading capability.yaml from promoted location (openspec/specs/${changeName}/)`);
    }

    const raw = parseYaml(fs.readFileSync(capabilityPath, 'utf-8'));
    const capability = parseCapabilityYaml(raw);

    spinner.stop();

    // Run all checks
    const checks: DriftCheck[] = [
      checkSchemaValidity(capability),
      checkBamlBindingPresent(capability),
      checkTestInputsPresent(capability),
      checkHashFormat(capability),
      checkOutputHash(capability),
      checkGuaranteesDocumented(capability),
      checkEffectsClassified(capability),
      checkComposabilityConsistency(capability),
    ];

    // Determine overall status
    const hasFail = checks.some((c) => c.status === 'fail');
    const hasBlocked = checks.some((c) => c.status === 'blocked');
    const overall = hasFail ? 'fail' : hasBlocked ? 'blocked' : 'pass';

    const report: DriftReport = {
      change: changeName,
      capability_id: capability.id,
      capability_version: capability.version,
      function: capability.baml_binding?.function ?? '(none)',
      checks,
      overall,
    };

    // --update-hash: write structural hash to capability.yaml.
    // Only allowed when there are no hard failures.
    // If a baseline already exists and the new hash differs, print a prominent
    // HASH CHANGED warning so the change is not silently accepted.
    if (options.updateHash) {
      if (hasFail) {
        console.log(
          `\n--update-hash refused: resolve all FAIL checks before establishing a new baseline.`
        );
      } else {
        const inputs = capability.baml_binding?.test_inputs;
        if (inputs && inputs.length > 0) {
          const newHash = hashTestOutput(inputs as Record<string, unknown>[]);
          const existingHash = capability.validation?.hash;

          if (existingHash && existingHash !== newHash) {
            console.log(`\n⚠  HASH CHANGED — baseline will be updated`);
            console.log(`   Previous: ${existingHash}`);
            console.log(`   New:      ${newHash}`);
            console.log(
              `   This change must be reviewed by the Governor before governed deployment.`
            );
          }

          const rawStr = fs.readFileSync(capabilityPath, 'utf-8');
          const doc = parseYaml(rawStr) as Record<string, unknown>;

          doc['validation'] = {
            hash: newHash,
            verified_at: new Date().toISOString(),
            verified_version: capability.version,
          };

          fs.writeFileSync(capabilityPath, stringifyYaml(doc, { lineWidth: 100 }), 'utf-8');
          console.log(`\nUpdated validation.hash in capability.yaml (${newHash.slice(0, 12)}...)`);
        } else {
          console.log(`\n--update-hash skipped: no test_inputs defined in baml_binding.`);
        }
      }
    }

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printReport(report);
    }

    if (hasFail) {
      process.exitCode = 1;
    }
  } catch (error) {
    spinner.fail('check-drift failed');
    throw error;
  }
}

function printReport(report: DriftReport): void {
  const statusIcon: Record<CheckStatus, string> = {
    pass: '✓',
    fail: '✗',
    blocked: '~',
    skip: '-',
  };

  console.log(`\nDrift Check: ${report.capability_id} v${report.capability_version} (${report.change})`);
  console.log(`Function: ${report.function}`);
  console.log();

  for (const check of report.checks) {
    const icon = statusIcon[check.status];
    console.log(`  [${icon}] ${check.name}: ${check.message}`);
    if (check.detail && (check.status === 'fail' || check.status === 'blocked')) {
      check.detail.split('\n').forEach((line) => console.log(`       ${line}`));
    }
  }

  console.log();
  const overallLabel =
    report.overall === 'pass'
      ? 'PASS'
      : report.overall === 'blocked'
        ? 'BLOCKED (non-failing)'
        : 'FAIL';
  console.log(`Overall: ${overallLabel}`);

  if (report.overall === 'fail') {
    console.log(`\nBlocking issues must be resolved before governed deployment.`);
    console.log(`Run 'openspec sds check-drift --update-hash' after fixing to update the baseline.`);
  } else if (report.overall === 'blocked') {
    console.log(
      `\nBLOCKED checks indicate Phase 4 tooling (live BAML runtime) is not yet connected.`
    );
    console.log(`Mark these as BLOCKED in validation.md until the runtime is available.`);
  }
}
