/**
 * SDS Extract Library Parts Command
 *
 * Scans change artifacts for XML-tagged blocks (<requirement>, <control>, <scenario>,
 * <evidence>, <capability>) that lack a library_source attribute. Identifies candidates
 * for parameterization and library extraction.
 *
 * At lean/standard tier: informational report only.
 * At governed tier: blocks promotion until each candidate is either extracted or
 *   explicitly acknowledged as deferred (written to library/extraction-backlog.yaml).
 */

import ora from 'ora';
import path from 'path';
import * as fs from 'fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { loadChangeContext } from '../../core/artifact-graph/index.js';
import { validateChangeExists } from './shared.js';
import { type SdsTier } from './sds-new-change.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ExtractLibraryPartsOptions {
  change?: string;
  deferAll?: boolean;
  json?: boolean;
}

interface TaggedBlock {
  tagType: string;
  id: string | null;
  hasLibrarySource: boolean;
  sourceFile: string;
  lineNumber: number;
  rawContent: string;
}

interface ExtractionCandidate {
  tagType: string;
  id: string | null;
  sourceFile: string;
  lineNumber: number;
  parameterizabilityScore: 'high' | 'medium' | 'low';
  concreteValues: string[];
  suggestedPartId: string;
}

interface BacklogEntry {
  change: string;
  tag_type: string;
  id: string | null;
  source_file: string;
  line_number: number;
  deferred_at: string;
  reason: string;
}

interface ExtractionReport {
  change: string;
  tier: string;
  scanned_files: number;
  total_tagged_blocks: number;
  blocks_with_source: number;
  candidates: ExtractionCandidate[];
  deferred_to_backlog: number;
  blocking: boolean;
}

type Tier = SdsTier | 'unknown';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const EXTRACTABLE_TAGS = ['requirement', 'control', 'scenario', 'evidence', 'capability'] as const;

const ARTIFACT_EXTENSIONS = ['.md', '.yaml', '.yml'];

// Heuristic: concrete value patterns that suggest a block is parameterizable
const CONCRETE_VALUE_PATTERNS = [
  /\bhttps?:\/\/[^\s>'"]+/g,               // URLs
  /\b[A-Z][A-Z0-9_]{2,}-\d+\b/g,          // Issue/ticket IDs like JIRA-123
  /\b\d{4}-\d{2}-\d{2}\b/g,               // Dates
  /["'][^"']{3,}["']/g,                    // Quoted string literals
  /\b(production|staging|dev)\b/gi,        // Environment names
  /\b\d+\s*(ms|seconds?|minutes?|hours?)\b/gi,  // Duration literals
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function tierFromSchema(schemaName: string): Tier {
  if (schemaName === 'sds-lean') return 'lean';
  if (schemaName === 'sds-standard') return 'standard';
  if (schemaName === 'sds-brownfield') return 'brownfield';
  if (schemaName === 'sds-governed') return 'governed';
  return 'unknown';
}

/**
 * Scan a single file for XML-tagged blocks, returning all found blocks.
 */
function scanFileForTags(filePath: string): TaggedBlock[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const blocks: TaggedBlock[] = [];
  const lines = content.split('\n');

  for (const tag of EXTRACTABLE_TAGS) {
    // Match opening tags: <requirement id="REQ-001" library_source="..."> or <requirement ...>
    const tagPattern = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi');
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(content)) !== null) {
      const attrStr = match[1] ?? '';
      const idMatch = attrStr.match(/\bid=["']([^"']+)["']/i);
      const hasLibrarySource = /\blibrary_source=["'][^"']+["']/i.test(attrStr);

      // Find line number
      const charsBefore = content.slice(0, match.index);
      const lineNumber = charsBefore.split('\n').length;

      // Extract the full block content up to the closing tag
      const closeTag = `</${tag}>`;
      const closeIdx = content.indexOf(closeTag, match.index);
      const rawContent =
        closeIdx >= 0
          ? content.slice(match.index, closeIdx + closeTag.length)
          : content.slice(match.index, Math.min(match.index + 500, content.length));

      blocks.push({
        tagType: tag,
        id: idMatch ? idMatch[1] : null,
        hasLibrarySource,
        sourceFile: filePath,
        lineNumber,
        rawContent,
      });
    }
  }

  return blocks;
}

/**
 * Find concrete values in block content that suggest parameterizability.
 */
function findConcreteValues(content: string): string[] {
  const found = new Set<string>();
  for (const pattern of CONCRETE_VALUE_PATTERNS) {
    const cloned = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = cloned.exec(content)) !== null) {
      found.add(m[0].trim());
    }
  }
  return [...found].slice(0, 5); // cap at 5 examples
}

/**
 * Score how parameterizable a block is based on its content.
 */
function scoreParameterizability(block: TaggedBlock): 'high' | 'medium' | 'low' {
  const concreteValues = findConcreteValues(block.rawContent);
  const wordCount = block.rawContent.split(/\s+/).length;

  if (concreteValues.length >= 3 && wordCount >= 20) return 'high';
  if (concreteValues.length >= 1 || wordCount >= 30) return 'medium';
  return 'low';
}

/**
 * Suggest a library part ID for an extraction candidate.
 */
function suggestPartId(block: TaggedBlock): string {
  const idPart = block.id
    ? block.id.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    : 'unnamed';
  return `${block.tagType}-snippets:${idPart}`;
}

/**
 * Get all artifact files in a change directory.
 */
function listChangeArtifacts(changeDir: string): string[] {
  try {
    return fs
      .readdirSync(changeDir)
      .filter((f) => ARTIFACT_EXTENSIONS.some((ext) => f.endsWith(ext)))
      .map((f) => path.join(changeDir, f));
  } catch {
    return [];
  }
}

/**
 * Append entries to the library extraction backlog.
 */
function appendToBacklog(backlogPath: string, entries: BacklogEntry[]): void {
  let existing: { schema?: string; entries?: BacklogEntry[] } = {};

  if (fs.existsSync(backlogPath)) {
    try {
      existing = parseYaml(fs.readFileSync(backlogPath, 'utf-8')) as typeof existing;
    } catch {
      existing = {};
    }
  }

  const currentEntries: BacklogEntry[] = existing.entries ?? [];
  const updated = {
    schema: existing.schema ?? 'sds-extraction-backlog/v1',
    entries: [...currentEntries, ...entries],
  };

  fs.writeFileSync(backlogPath, stringifyYaml(updated, { lineWidth: 100 }), 'utf-8');
}

// -----------------------------------------------------------------------------
// Command Implementation
// -----------------------------------------------------------------------------

export async function sdsExtractLibraryPartsCommand(
  options: ExtractLibraryPartsOptions
): Promise<void> {
  const spinner = ora('Scanning change artifacts for extraction candidates...').start();

  try {
    const projectRoot = process.cwd();
    const changeName = await validateChangeExists(options.change, projectRoot);
    const context = loadChangeContext(projectRoot, changeName);
    const tier = tierFromSchema(context.schemaName);
    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);
    const backlogPath = path.join(projectRoot, 'openspec', 'library', 'extraction-backlog.yaml');

    const artifactFiles = listChangeArtifacts(changeDir);
    const allBlocks: TaggedBlock[] = [];

    for (const filePath of artifactFiles) {
      allBlocks.push(...scanFileForTags(filePath));
    }

    const candidates: ExtractionCandidate[] = allBlocks
      .filter((b) => !b.hasLibrarySource)
      .map((b) => ({
        tagType: b.tagType,
        id: b.id,
        sourceFile: path.relative(projectRoot, b.sourceFile),
        lineNumber: b.lineNumber,
        parameterizabilityScore: scoreParameterizability(b),
        concreteValues: findConcreteValues(b.rawContent),
        suggestedPartId: suggestPartId(b),
      }));

    const report: ExtractionReport = {
      change: changeName,
      tier,
      scanned_files: artifactFiles.length,
      total_tagged_blocks: allBlocks.length,
      blocks_with_source: allBlocks.filter((b) => b.hasLibrarySource).length,
      candidates,
      deferred_to_backlog: 0,
      blocking: tier === 'governed' && candidates.length > 0,
    };

    // At governed tier: write candidates to backlog if --defer-all or if blocking
    if (options.deferAll || (tier === 'governed' && candidates.length > 0)) {
      const timestamp = new Date().toISOString();
      const backlogEntries: BacklogEntry[] = candidates.map((c) => ({
        change: changeName,
        tag_type: c.tagType,
        id: c.id,
        source_file: c.sourceFile,
        line_number: c.lineNumber,
        deferred_at: timestamp,
        reason: options.deferAll
          ? 'explicitly deferred via --defer-all'
          : 'governed tier: auto-deferred pending library review',
      }));

      if (backlogEntries.length > 0) {
        appendToBacklog(backlogPath, backlogEntries);
        report.deferred_to_backlog = backlogEntries.length;
      }
    }

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printReport(report, projectRoot);
    }

    // At governed tier, exit non-zero if there are unacknowledged candidates
    if (tier === 'governed' && candidates.length > 0 && !options.deferAll) {
      process.exitCode = 1;
    }
  } catch (error) {
    spinner.fail('Extraction scan failed');
    throw error;
  }
}

function printReport(report: ExtractionReport, projectRoot: string): void {
  const { change, tier, scanned_files, total_tagged_blocks, blocks_with_source, candidates } =
    report;

  console.log(`\nExtraction Scan: ${change} (tier: ${tier})`);
  console.log(`  Files scanned:      ${scanned_files}`);
  console.log(`  Tagged blocks:      ${total_tagged_blocks}`);
  console.log(`  With library_source: ${blocks_with_source}`);
  console.log(`  Candidates:         ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('\nAll tagged blocks have library_source provenance.');
    return;
  }

  console.log('\nExtraction Candidates:\n');

  for (const c of candidates) {
    const idLabel = c.id ? ` [${c.id}]` : '';
    console.log(`  <${c.tagType}>${idLabel}`);
    console.log(`    File:          ${c.sourceFile}:${c.lineNumber}`);
    console.log(`    Score:         ${c.parameterizabilityScore}`);
    console.log(`    Suggested ID:  ${c.suggestedPartId}`);
    if (c.concreteValues.length > 0) {
      console.log(`    Concrete vals: ${c.concreteValues.join(', ')}`);
    }
    console.log();
  }

  if (tier === 'governed' && report.blocking) {
    console.log(
      'GOVERNED TIER: Promotion is blocked until each candidate is extracted or deferred.\n' +
        'Options:\n' +
        '  1. Extract: add library_source="..." to the XML tag and open a PR to add to library\n' +
        `  2. Defer:   re-run with --defer-all to write candidates to library/extraction-backlog.yaml`
    );
  } else if (report.deferred_to_backlog > 0) {
    console.log(
      `${report.deferred_to_backlog} candidate(s) written to openspec/library/extraction-backlog.yaml`
    );
  }
}
