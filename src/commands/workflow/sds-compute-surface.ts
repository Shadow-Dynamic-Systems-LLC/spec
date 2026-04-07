/**
 * SDS Compute Surface Command
 *
 * Reads controls.md, capability.yaml, risk.md, and library/capability/registry.yaml
 * for the current change. Computes the capability surface — what becomes newly
 * possible, what expands, what is conditional, and what is blocked — then writes
 * the result to capability_surface.md as a timestamped build artifact.
 *
 * This is a non-interactive command. It OVERWRITES capability_surface.md on every run.
 * Per governance rule #4, capability_surface.md MUST be re-run after any edit to
 * capability.yaml or controls.md.
 *
 * Output: <change-dir>/capability_surface.md
 */

import ora from 'ora';
import path from 'path';
import * as fs from 'fs';
import { parse as parseYaml } from 'yaml';
import { loadChangeContext } from '../../core/artifact-graph/index.js';
import { validateChangeExists } from './shared.js';
import {
  safeParseCapabilityYaml,
  type CapabilityYaml,
  type Composability,
} from '../../core/capability/schema.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ComputeSurfaceOptions {
  change?: string;
  json?: boolean;
}

interface RegistryEntry {
  id: string;
  name: string;
  type: string;
  description: string;
  domain_tags: string[];
  version: string;
  status: string;
  known_dependencies?: string[];
}

interface SurfaceItem {
  id: string;
  name: string;
  description: string;
  reason: string;
}

interface CapabilitySurface {
  change: string;
  generated_at: string;
  newly_enabled: SurfaceItem[];
  expanded_domains: SurfaceItem[];
  conditional: SurfaceItem[];
  dead_zones: SurfaceItem[];
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function readFileOptional(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Extract control enforcement tags from controls.md content.
 * Returns a set of blocked/constrained capability IDs.
 */
function extractControlledCapabilities(controlsContent: string | null): {
  blocked: Set<string>;
  constrained: Set<string>;
} {
  const blocked = new Set<string>();
  const constrained = new Set<string>();

  if (!controlsContent) return { blocked, constrained };

  // Look for control blocks that reference capability IDs
  const hardControlPattern = /<control[^>]+enforcement_level=["']hard["'][^>]*>/g;
  const softControlPattern = /<control[^>]+enforcement_level=["']soft["'][^>]*>/g;
  const producedByPattern = /evidence_produced_by=["']([^"']+)["']/g;

  // "no external without approval" → marks external_api_call as constrained
  if (/effects\.external\s*==\s*true/i.test(controlsContent)) {
    constrained.add('external_api_call');
  }

  // Cost gate blocks execution
  if (/cost_gate/i.test(controlsContent)) {
    constrained.add('cost_gate');
  }

  // Scope boundary
  if (/scope_boundary/i.test(controlsContent)) {
    constrained.add('scope_boundary');
  }

  return { blocked, constrained };
}

/**
 * Extract risk failure modes from risk.md content.
 * Returns capability IDs that are referenced as high-risk or out-of-scope.
 */
function extractRiskBoundaries(riskContent: string | null): Set<string> {
  const outOfScope = new Set<string>();
  if (!riskContent) return outOfScope;

  // Look for risk blocks that mention capabilities as failure modes
  const riskPattern = /<risk[^>]+/g;
  const capabilityPattern = /\b(human_approval_gate|audit_log|external_api_call|escalation_policy|memory_snapshot|deterministic_replay|reversible_mutation|cost_gate|scope_boundary|idempotent_retry)\b/g;

  // Capabilities mentioned in CRITICAL risk items are treated as over-constrained
  const criticalBlock = /<risk[^>]+severity=["']critical["'][^>]*>[\s\S]*?<\/risk>/gi;
  let m: RegExpExecArray | null;

  while ((m = criticalBlock.exec(riskContent)) !== null) {
    const block = m[0];
    let cap: RegExpExecArray | null;
    while ((cap = capabilityPattern.exec(block)) !== null) {
      outOfScope.add(cap[1]);
    }
  }

  return outOfScope;
}

/**
 * Compute which registry capabilities are newly enabled, expanded, conditional,
 * or dead-zoned by this change's capability.yaml and controls.
 */
function computeSurface(
  capability: CapabilityYaml | null,
  registry: RegistryEntry[],
  controlled: { blocked: Set<string>; constrained: Set<string> },
  riskBoundaries: Set<string>
): Omit<CapabilitySurface, 'change' | 'generated_at'> {
  const newly_enabled: SurfaceItem[] = [];
  const expanded_domains: SurfaceItem[] = [];
  const conditional: SurfaceItem[] = [];
  const dead_zones: SurfaceItem[] = [];

  if (!capability) {
    return { newly_enabled, expanded_domains, conditional, dead_zones };
  }

  const composability: Composability = capability.composability;
  const compatible = new Set(composability.compatible_with);
  const conflicts = new Set(composability.conflicts_with);
  const requiresBefore = new Set(composability.requires_before);
  const requiresAfter = new Set(composability.requires_after);

  // The new capability itself
  const selfEntry: SurfaceItem = {
    id: capability.id,
    name: capability.id.replace(/_/g, ' '),
    description: capability.description.trim(),
    reason: 'Primary capability introduced by this change',
  };

  // Determine placement of the primary capability
  if (riskBoundaries.has(capability.id)) {
    dead_zones.push({ ...selfEntry, reason: 'Referenced in CRITICAL risk failure mode — over-constrained' });
  } else if (controlled.constrained.has(capability.id)) {
    conditional.push({ ...selfEntry, reason: 'Subject to hard controls — requires gate before execution' });
  } else if (capability.effects.external) {
    conditional.push({
      ...selfEntry,
      reason: `External capability (effects.external: true) — requires human_approval_gate`,
    });
  } else {
    newly_enabled.push(selfEntry);
  }

  // Walk the registry to find what this change expands
  for (const entry of registry) {
    if (entry.id === capability.id) continue;
    if (entry.status !== 'active') continue;

    // Skip capabilities in the conflicts list
    if (conflicts.has(entry.id)) {
      dead_zones.push({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        reason: `Declared in composability.conflicts_with — cannot compose with ${capability.id}`,
      });
      continue;
    }

    // Capabilities in requires_before / requires_after: conditional on this change
    if (requiresBefore.has(entry.id) || requiresAfter.has(entry.id)) {
      const position = requiresBefore.has(entry.id) ? 'requires_before' : 'requires_after';
      if (!conditional.some((c) => c.id === entry.id)) {
        conditional.push({
          id: entry.id,
          name: entry.name,
          description: entry.description,
          reason: `Required in ${position} position by ${capability.id}`,
        });
      }
      continue;
    }

    // Compatible capabilities: execution domain expands
    if (compatible.has(entry.id)) {
      expanded_domains.push({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        reason: `Declared in composability.compatible_with — composable with ${capability.id}`,
      });
    }
  }

  return { newly_enabled, expanded_domains, conditional, dead_zones };
}

// -----------------------------------------------------------------------------
// Markdown renderer
// -----------------------------------------------------------------------------

function renderSurfaceMarkdown(surface: CapabilitySurface): string {
  function renderList(items: SurfaceItem[]): string {
    if (items.length === 0) return '_None_\n';
    return items
      .map(
        (item) =>
          `### \`${item.id}\`\n\n` +
          `${item.description}\n\n` +
          `**Why:** ${item.reason}\n`
      )
      .join('\n');
  }

  return [
    `# Capability Surface`,
    ``,
    `<!-- BUILD ARTIFACT — generated by /sds:compute-surface — DO NOT EDIT -->`,
    `<!-- Change: ${surface.change} -->`,
    `<!-- Generated: ${surface.generated_at} -->`,
    ``,
    `## Newly Enabled Capabilities`,
    ``,
    `Capabilities that this change makes available for the first time.`,
    ``,
    renderList(surface.newly_enabled),
    `## Expanded Execution Domains`,
    ``,
    `Existing capabilities whose execution domain grows because they are now composable with the new capability.`,
    ``,
    renderList(surface.expanded_domains),
    `## Conditional Capabilities`,
    ``,
    `Capabilities that are available only under specific conditions (controls, gates, or composition requirements).`,
    ``,
    renderList(surface.conditional),
    `## Dead Zones (Over-Constrained)`,
    ``,
    `Capabilities that are blocked or conflicted by the controls or composability declarations in this change.`,
    ``,
    renderList(surface.dead_zones),
  ].join('\n');
}

// -----------------------------------------------------------------------------
// Command Implementation
// -----------------------------------------------------------------------------

export async function sdsComputeSurfaceCommand(options: ComputeSurfaceOptions): Promise<void> {
  const spinner = ora('Computing capability surface...').start();

  try {
    const projectRoot = process.cwd();
    const changeName = await validateChangeExists(options.change, projectRoot);
    const context = loadChangeContext(projectRoot, changeName);

    if (!context.schemaName.startsWith('sds-governed')) {
      spinner.warn(
        `compute-surface is intended for governed-tier changes (schema: ${context.schemaName}).`
      );
    }

    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);
    const libraryRoot = path.join(projectRoot, 'openspec', 'library');
    const registryPath = path.join(libraryRoot, 'capability', 'registry.yaml');

    // Load inputs
    const capabilityRaw = readFileOptional(path.join(changeDir, 'capability.yaml'));
    const controlsContent = readFileOptional(path.join(changeDir, 'controls.md'));
    const riskContent = readFileOptional(path.join(changeDir, 'risk.md'));
    const registryContent = readFileOptional(registryPath);

    if (!registryContent) {
      spinner.fail(`Registry not found at: openspec/library/capability/registry.yaml`);
      throw new Error('Cannot compute surface without the capability registry.');
    }

    // Parse capability.yaml — optional (surface is partial without it)
    let capability: CapabilityYaml | null = null;
    if (capabilityRaw) {
      const result = safeParseCapabilityYaml(parseYaml(capabilityRaw));
      if (result.success) {
        capability = result.data;
      } else {
        spinner.warn(
          `capability.yaml has validation errors — surface will be incomplete.\n` +
            result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
        );
      }
    } else {
      spinner.warn(`capability.yaml not found — surface will be incomplete.`);
    }

    const registry = parseYaml(registryContent) as RegistryEntry[];
    const controlled = extractControlledCapabilities(controlsContent);
    const riskBoundaries = extractRiskBoundaries(riskContent);

    const surfaceData = computeSurface(capability, registry, controlled, riskBoundaries);
    const surface: CapabilitySurface = {
      change: changeName,
      generated_at: new Date().toISOString(),
      ...surfaceData,
    };

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(surface, null, 2));
      return;
    }

    const outPath = path.join(changeDir, 'capability_surface.md');
    fs.writeFileSync(outPath, renderSurfaceMarkdown(surface), 'utf-8');

    const total =
      surface.newly_enabled.length +
      surface.expanded_domains.length +
      surface.conditional.length +
      surface.dead_zones.length;

    console.log(`Written: openspec/changes/${changeName}/capability_surface.md`);
    console.log(
      `  Newly enabled:  ${surface.newly_enabled.length}  |  ` +
        `Expanded: ${surface.expanded_domains.length}  |  ` +
        `Conditional: ${surface.conditional.length}  |  ` +
        `Dead zones: ${surface.dead_zones.length}`
    );

    if (surface.dead_zones.length > 0) {
      console.log(
        `\nDead zones detected — review controls.md and composability.conflicts_with to confirm intent.`
      );
    }
  } catch (error) {
    spinner.fail('compute-surface failed');
    throw error;
  }
}
