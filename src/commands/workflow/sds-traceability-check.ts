/**
 * SDS Traceability Check Command
 *
 * Two functions in one command:
 *
 * 1. GENERATION mode (default): Scans all change artifacts for XML-tagged blocks,
 *    resolves cross-references by id, writes linkage map to traceability.md.
 *    Preserves the traceability_overrides section across regeneration runs.
 *
 * 2. VALIDATION mode (--validate): Checks completeness rules:
 *    - Every <requirement> → at least one linked <scenario> or <evidence>
 *    - Every <control>     → at least one <requirement> + one <evidence>
 *    - Every <decision>    → at least one <requirement>
 *    - Library deviation provenance recorded (library_source present)
 *
 *    Warnings at lean/standard tier. Errors (blocking, exit non-zero) at governed.
 *
 * Output: <change-dir>/traceability.md (overwrites on regeneration)
 */

import ora from 'ora';
import path from 'path';
import * as fs from 'fs';
import { loadChangeContext } from '../../core/artifact-graph/index.js';
import { validateChangeExists } from './shared.js';
import { type SdsTier } from './sds-new-change.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TraceabilityCheckOptions {
  change?: string;
  validate?: boolean;
  json?: boolean;
}

type TagType = 'requirement' | 'control' | 'decision' | 'evidence' | 'scenario' | 'capability' | 'risk';

interface TaggedBlock {
  tagType: TagType;
  id: string;
  sourceFile: string;
  lineNumber: number;
  attributes: Record<string, string>;
  content: string;
}

interface TraceLink {
  from: string;
  to: string;
  via: string; // attribute that establishes the link (e.g., "control", "evidence_id")
}

interface ValidationIssue {
  severity: 'error' | 'warning';
  rule: string;
  message: string;
  affectedId: string;
}

interface TraceabilityGraph {
  change: string;
  generated_at: string;
  blocks: TaggedBlock[];
  links: TraceLink[];
  issues: ValidationIssue[];
}

type Tier = SdsTier | 'unknown';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const SCANNABLE_EXTENSIONS = ['.md', '.yaml', '.yml'];
const SCANNABLE_TAG_TYPES: TagType[] = [
  'requirement',
  'control',
  'decision',
  'evidence',
  'scenario',
  'capability',
  'risk',
];

function tierFromSchema(schemaName: string): Tier {
  if (schemaName === 'sds-lean') return 'lean';
  if (schemaName === 'sds-standard') return 'standard';
  if (schemaName === 'sds-brownfield') return 'brownfield';
  if (schemaName === 'sds-governed') return 'governed';
  return 'unknown';
}

/**
 * Parse all attribute key="value" pairs from an XML opening tag's attribute string.
 */
function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /(\w+)=["']([^"']*)["']/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(attrStr)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

/**
 * Scan a single file for XML-tagged blocks of the known tag types.
 */
function scanFile(filePath: string, projectRoot: string): TaggedBlock[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const blocks: TaggedBlock[] = [];
  const relPath = path.relative(projectRoot, filePath);

  for (const tag of SCANNABLE_TAG_TYPES) {
    const openPattern = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi');
    const closeTag = `</${tag}>`;

    let m: RegExpExecArray | null;
    while ((m = openPattern.exec(content)) !== null) {
      const attrStr = m[1] ?? '';
      const attrs = parseAttributes(attrStr);
      const id = attrs['id'] ?? '';

      const closeIdx = content.indexOf(closeTag, m.index + m[0].length);
      const blockContent =
        closeIdx >= 0
          ? content.slice(m.index + m[0].length, closeIdx).trim()
          : '';

      const linesBefore = content.slice(0, m.index).split('\n');
      const lineNumber = linesBefore.length;

      blocks.push({
        tagType: tag,
        id,
        sourceFile: relPath,
        lineNumber,
        attributes: attrs,
        content: blockContent,
      });
    }
  }

  return blocks;
}

/**
 * Resolve cross-references between blocks.
 * Links are established by:
 *   - <evidence control="CTL-001"> → evidence links to requirement
 *   - <scenario evidence_id="EVD-001"> → scenario links to evidence
 *   - <control> body mentioning requirement IDs (REQ-NNN)
 *   - <decision> body mentioning requirement IDs
 */
function resolveLinks(blocks: TaggedBlock[]): TraceLink[] {
  const links: TraceLink[] = [];
  const idSet = new Set(blocks.map((b) => b.id).filter(Boolean));

  for (const block of blocks) {
    // Attribute-level links
    for (const [attr, val] of Object.entries(block.attributes)) {
      if (attr === 'id') continue;
      if (idSet.has(val)) {
        links.push({ from: block.id, to: val, via: attr });
      }
      // Comma-separated attribute values (e.g., control="CTL-001,CTL-002")
      if (val.includes(',')) {
        for (const part of val.split(',').map((s) => s.trim())) {
          if (idSet.has(part)) {
            links.push({ from: block.id, to: part, via: attr });
          }
        }
      }
    }

    // Content-level cross-references (REQ-NNN, CTL-NNN, ADR-NNN, EVD-NNN, SCN-NNN, RSK-NNN)
    const refPattern = /\b(REQ|CTL|ADR|EVD|SCN|RSK)-[A-Z0-9]+\b/g;
    let m: RegExpExecArray | null;
    while ((m = refPattern.exec(block.content)) !== null) {
      const refId = m[0];
      if (idSet.has(refId) && refId !== block.id) {
        // Avoid duplicate links
        if (!links.some((l) => l.from === block.id && l.to === refId && l.via === 'content_ref')) {
          links.push({ from: block.id, to: refId, via: 'content_ref' });
        }
      }
    }
  }

  return links;
}

/**
 * Validate completeness rules against the graph.
 */
function validateGraph(
  blocks: TaggedBlock[],
  links: TraceLink[],
  tier: Tier
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const isGoverned = tier === 'governed';

  const blockById = new Map(blocks.map((b) => [b.id, b]));
  const linkedTo = new Set(links.map((l) => l.to));
  const linkedFrom = new Map<string, string[]>();

  for (const link of links) {
    if (!linkedFrom.has(link.from)) linkedFrom.set(link.from, []);
    linkedFrom.get(link.from)!.push(link.to);
  }

  for (const block of blocks) {
    if (!block.id) {
      issues.push({
        severity: isGoverned ? 'error' : 'warning',
        rule: 'id_required',
        message: `<${block.tagType}> block at ${block.sourceFile}:${block.lineNumber} has no id attribute`,
        affectedId: `(anonymous:${block.sourceFile}:${block.lineNumber})`,
      });
      continue;
    }

    const targets = linkedFrom.get(block.id) ?? [];

    if (block.tagType === 'requirement') {
      const hasScenario = blocks.some(
        (b) => (b.tagType === 'scenario' || b.tagType === 'evidence') &&
          (linkedFrom.get(b.id) ?? []).includes(block.id)
      );
      // Also check if any scenario/evidence links TO this requirement
      const linkedFromScenariosOrEvidence = links.some(
        (l) => l.to === block.id &&
          (blockById.get(l.from)?.tagType === 'scenario' ||
           blockById.get(l.from)?.tagType === 'evidence')
      );

      if (!hasScenario && !linkedFromScenariosOrEvidence && targets.length === 0) {
        issues.push({
          severity: isGoverned ? 'error' : 'warning',
          rule: 'requirement_needs_scenario_or_evidence',
          message: `<requirement id="${block.id}"> has no linked <scenario> or <evidence>`,
          affectedId: block.id,
        });
      }
    }

    if (block.tagType === 'control') {
      const hasRequirement = links.some(
        (l) =>
          (l.from === block.id || l.to === block.id) &&
          (blockById.get(l.from)?.tagType === 'requirement' ||
           blockById.get(l.to)?.tagType === 'requirement')
      );
      const hasEvidence = links.some(
        (l) =>
          (l.from === block.id || l.to === block.id) &&
          (blockById.get(l.from)?.tagType === 'evidence' ||
           blockById.get(l.to)?.tagType === 'evidence')
      );

      if (!hasRequirement) {
        issues.push({
          severity: isGoverned ? 'error' : 'warning',
          rule: 'control_needs_requirement',
          message: `<control id="${block.id}"> has no linked <requirement>`,
          affectedId: block.id,
        });
      }
      if (!hasEvidence) {
        issues.push({
          severity: isGoverned ? 'error' : 'warning',
          rule: 'control_needs_evidence',
          message: `<control id="${block.id}"> has no linked <evidence>`,
          affectedId: block.id,
        });
      }
    }

    if (block.tagType === 'decision') {
      const hasRequirement = links.some(
        (l) =>
          (l.from === block.id || l.to === block.id) &&
          (blockById.get(l.from)?.tagType === 'requirement' ||
           blockById.get(l.to)?.tagType === 'requirement')
      );

      if (!hasRequirement) {
        issues.push({
          severity: isGoverned ? 'error' : 'warning',
          rule: 'decision_needs_requirement',
          message: `<decision id="${block.id}"> in ${block.sourceFile} has no linked <requirement>`,
          affectedId: block.id,
        });
      }
    }

    // Library provenance check: blocks without library_source are informational
    if (!block.attributes['library_source']) {
      issues.push({
        severity: 'warning',
        rule: 'library_source_missing',
        message: `<${block.tagType} id="${block.id}"> has no library_source attribute — consider extraction or provenance annotation`,
        affectedId: block.id,
      });
    }
  }

  return issues;
}

// -----------------------------------------------------------------------------
// Traceability.md renderer
// -----------------------------------------------------------------------------

/**
 * Extract the traceability_overrides section from existing traceability.md.
 * This section is preserved across regeneration runs.
 */
function extractOverrides(existing: string | null): string {
  if (!existing) return '';
  const marker = '## traceability_overrides';
  const idx = existing.indexOf(marker);
  return idx >= 0 ? existing.slice(idx) : '';
}

function renderTraceabilityMarkdown(
  graph: TraceabilityGraph,
  overrides: string
): string {
  const { change, generated_at, blocks, links, issues } = graph;

  const byType = (type: TagType) => blocks.filter((b) => b.tagType === type);
  const linksFrom = (id: string) => links.filter((l) => l.from === id).map((l) => l.to);
  const linksTo = (id: string) => links.filter((l) => l.to === id).map((l) => l.from);

  function renderBlockTable(tagBlocks: TaggedBlock[]): string {
    if (tagBlocks.length === 0) return '_None_\n';
    return [
      '| ID | Source | Linked To | Linked From |',
      '|---|---|---|---|',
      ...tagBlocks.map((b) => {
        const to = linksFrom(b.id).join(', ') || '—';
        const from = linksTo(b.id).join(', ') || '—';
        return `| \`${b.id || '(no id)'}\` | ${b.sourceFile}:${b.lineNumber} | ${to} | ${from} |`;
      }),
    ].join('\n');
  }

  const lines: string[] = [
    `# Traceability: ${change}`,
    ``,
    `<!-- BUILD ARTIFACT — generated by /sds:traceability-check — DO NOT EDIT -->`,
    `<!-- DO NOT EDIT except within the traceability_overrides section below -->`,
    `<!-- Last generated: ${generated_at} -->`,
    ``,
  ];

  if (issues.filter((i) => i.severity === 'error').length > 0) {
    lines.push(
      `> ⛔ **${issues.filter((i) => i.severity === 'error').length} error(s)** — resolve before governed merge.`,
      ``
    );
  }

  lines.push(`## Requirements`, ``, renderBlockTable(byType('requirement')), ``);
  lines.push(`## Controls`, ``, renderBlockTable(byType('control')), ``);
  lines.push(`## Decisions`, ``, renderBlockTable(byType('decision')), ``);
  lines.push(`## Evidence`, ``, renderBlockTable(byType('evidence')), ``);

  // Library deviations
  const noSource = blocks.filter((b) => !b.attributes['library_source']);
  lines.push(`## Library Deviations`, ``);
  if (noSource.length === 0) {
    lines.push(`_All tagged blocks have library_source provenance._`, ``);
  } else {
    lines.push(
      `The following blocks have no \`library_source\` attribute. ` +
        `Either add provenance or run \`openspec sds extract-library-parts\` to register in extraction backlog.`,
      ``,
      '| ID | Tag | Source |',
      '|---|---|---|',
      ...noSource.map((b) => `| \`${b.id || '(no id)'}\` | \`${b.tagType}\` | ${b.sourceFile}:${b.lineNumber} |`),
      ``
    );
  }

  // Validation issues
  if (issues.length > 0) {
    lines.push(`## Validation Issues`, ``);
    for (const issue of issues.filter((i) => i.severity !== 'warning' || i.rule !== 'library_source_missing')) {
      lines.push(`- **[${issue.severity.toUpperCase()}]** \`${issue.rule}\` (${issue.affectedId}): ${issue.message}`);
    }
    lines.push(``);
  }

  // Overrides section — preserved across regeneration
  lines.push(`---`, ``);
  if (overrides) {
    lines.push(overrides);
  } else {
    lines.push(
      `## traceability_overrides`,
      ``,
      `<!-- This section is preserved across regeneration runs. -->`,
      `<!-- Use for traceability links that cannot be expressed through XML tag cross-references, -->`,
      `<!-- e.g., external compliance mappings, manual attestations, legacy references. -->`,
      ``,
      `<!-- Format:`,
      `- id: OVERRIDE-001`,
      `  type: external_compliance_mapping | manual_attestation | legacy_reference`,
      `  description: >`,
      `    What this link represents`,
      `  source: <requirement/control/decision ID>`,
      `  target: <external reference, e.g., "NIST SP 800-53 AC-2">`,
      `  attested_by: <role or identity>`,
      `  attested_at: <ISO8601>`,
      `-->`,
      ``
    );
  }

  return lines.join('\n');
}

// -----------------------------------------------------------------------------
// Command Implementation
// -----------------------------------------------------------------------------

export async function sdsTraceabilityCheckCommand(
  options: TraceabilityCheckOptions
): Promise<void> {
  const spinner = ora('Scanning artifacts for traceability graph...').start();

  try {
    const projectRoot = process.cwd();
    const changeName = await validateChangeExists(options.change, projectRoot);
    const context = loadChangeContext(projectRoot, changeName);
    const tier = tierFromSchema(context.schemaName);
    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);

    // Scan all artifact files
    const files = fs
      .readdirSync(changeDir)
      .filter((f) => SCANNABLE_EXTENSIONS.some((ext) => f.endsWith(ext)))
      .map((f) => path.join(changeDir, f));

    const allBlocks: TaggedBlock[] = [];
    for (const filePath of files) {
      allBlocks.push(...scanFile(filePath, projectRoot));
    }

    const links = resolveLinks(allBlocks);
    const issues = validateGraph(allBlocks, links, tier);

    const graph: TraceabilityGraph = {
      change: changeName,
      generated_at: new Date().toISOString(),
      blocks: allBlocks,
      links,
      issues,
    };

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(graph, null, 2));
      const hasErrors = issues.some((i) => i.severity === 'error');
      if (hasErrors && tier === 'governed') process.exitCode = 1;
      return;
    }

    const traceabilityPath = path.join(changeDir, 'traceability.md');
    const existing = fs.existsSync(traceabilityPath)
      ? fs.readFileSync(traceabilityPath, 'utf-8')
      : null;
    const overrides = extractOverrides(existing);

    if (options.validate) {
      // Validation-only mode: print issues, do not write
      if (issues.length === 0) {
        console.log(`Traceability check PASSED (${allBlocks.length} blocks, ${links.length} links)`);
        return;
      }

      const errors = issues.filter((i) => i.severity === 'error');
      const warnings = issues.filter((i) => i.severity === 'warning');

      if (errors.length > 0) {
        console.log(`\nErrors (${errors.length}):`);
        errors.forEach((e) => console.log(`  [ERROR] ${e.rule}: ${e.message}`));
      }
      if (warnings.length > 0) {
        console.log(`\nWarnings (${warnings.length}):`);
        warnings.forEach((w) => console.log(`  [WARN]  ${w.rule}: ${w.message}`));
      }

      if (errors.length > 0 && tier === 'governed') {
        console.log(`\nGoverned tier: ${errors.length} error(s) must be resolved before merge.`);
        process.exitCode = 1;
      }
      return;
    }

    // Generation mode: write traceability.md
    fs.writeFileSync(
      traceabilityPath,
      renderTraceabilityMarkdown(graph, overrides),
      'utf-8'
    );

    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning' && i.rule !== 'library_source_missing').length;

    console.log(`Written: openspec/changes/${changeName}/traceability.md`);
    console.log(
      `  Blocks: ${allBlocks.length}  |  Links: ${links.length}  |  ` +
        `Errors: ${errors}  |  Warnings: ${warnings}`
    );

    if (errors > 0 && tier === 'governed') {
      console.log(
        `\nGoverned tier: ${errors} error(s) must be resolved before merge.\n` +
          `Run with --validate to see detailed issue list.`
      );
      process.exitCode = 1;
    } else if (errors > 0) {
      console.log(`\n${errors} error(s) found. Run with --validate for details.`);
    }
  } catch (error) {
    spinner.fail('traceability-check failed');
    throw error;
  }
}
