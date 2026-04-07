/**
 * SDS Compose From Library Command
 *
 * Instantiates a reusable library part (capability, snippet, or pattern) into the
 * current change directory. Substitutes --vars key=value pairs into the template,
 * writes the instantiated draft, and records provenance in traceability.md.
 *
 * Usage:
 *   openspec sds compose-from-library <part-id> [--vars key=value...]
 */

import ora from 'ora';
import path from 'path';
import * as fs from 'fs';
import { parse as parseYaml } from 'yaml';
import { loadChangeContext } from '../../core/artifact-graph/index.js';
import { validateChangeExists } from './shared.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ComposeFromLibraryOptions {
  change?: string;
  vars?: string[];
  dryRun?: boolean;
}

interface RegistryEntry {
  id: string;
  name: string;
  type: string;
  description: string;
  version: string;
  status: string;
  variables?: Array<{ name: string; type: string; description: string; default?: unknown }>;
}

type VarMap = Record<string, string>;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const VALID_PART_PREFIXES = ['cap:', 'snippet:', 'pattern:'] as const;

/**
 * Resolve a library part by ID. Searches:
 *   cap:<id>      → capability in registry.yaml
 *   snippet:<id>  → snippet in library/snippets/
 *   pattern:<id>  → pattern in library/patterns/<id>/pattern.md
 *
 * Returns { templateContent, sourcePath, registryEntry | null }
 */
function resolveLibraryPart(
  libraryRoot: string,
  partId: string
): { templateContent: string; sourcePath: string; registryEntry: RegistryEntry | null } | null {
  // Capability from registry.yaml
  if (partId.startsWith('cap:')) {
    const capId = partId.slice(4);
    const registryPath = path.join(libraryRoot, 'capability', 'registry.yaml');
    const rawRegistry = fs.readFileSync(registryPath, 'utf-8');
    const registry = parseYaml(rawRegistry) as RegistryEntry[];
    const entry = registry.find((e) => e.id === capId);
    if (!entry) return null;

    // Build a minimal template from the registry entry description
    const template = [
      `<capability id="${entry.id}" library_source="registry.yaml#${entry.id}" version="${entry.version}">`,
      `  <!-- ${entry.name} -->`,
      `  <!-- ${entry.description.trim()} -->`,
      '',
      `  <!-- Required variables: -->`,
      ...(entry.variables ?? []).map(
        (v) => `  <!-- ${v.name} (${v.type}): ${v.description}${v.default !== undefined ? ` [default: ${v.default}]` : ''} -->`
      ),
      '</capability>',
    ].join('\n');

    return {
      templateContent: template,
      sourcePath: `registry.yaml#${entry.id}`,
      registryEntry: entry,
    };
  }

  // Pattern from library/patterns/<slug>/pattern.md
  if (partId.startsWith('pattern:')) {
    const patternSlug = partId.slice(8);
    const patternPath = path.join(libraryRoot, 'patterns', patternSlug, 'pattern.md');
    if (!fs.existsSync(patternPath)) return null;

    return {
      templateContent: fs.readFileSync(patternPath, 'utf-8'),
      sourcePath: `library/patterns/${patternSlug}/pattern.md`,
      registryEntry: null,
    };
  }

  // Snippet from library/snippets/<file>.md — partId like snippet:requirement-snippets:REQ-SCN-001
  if (partId.startsWith('snippet:')) {
    const rest = partId.slice(8);
    const colonIdx = rest.indexOf(':');
    const snippetFile = colonIdx >= 0 ? rest.slice(0, colonIdx) : rest;
    const snippetPath = path.join(libraryRoot, 'snippets', `${snippetFile}.md`);
    if (!fs.existsSync(snippetPath)) return null;

    return {
      templateContent: fs.readFileSync(snippetPath, 'utf-8'),
      sourcePath: `library/snippets/${snippetFile}.md`,
      registryEntry: null,
    };
  }

  return null;
}

/**
 * Substitute {{VARIABLE_NAME}} placeholders in template content with provided vars.
 * Returns the substituted content and a list of unfilled placeholders.
 */
function substituteVars(
  content: string,
  vars: VarMap
): { content: string; unfilled: string[] } {
  const unfilled: string[] = [];
  const substituted = content.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (match, key) => {
    if (key in vars) return vars[key];
    unfilled.push(key);
    return match; // leave unfilled placeholders intact
  });
  return { content: substituted, unfilled };
}

/**
 * Parse --vars key=value pairs into a VarMap.
 */
function parseVars(varsArgs: string[]): VarMap {
  const result: VarMap = {};
  for (const arg of varsArgs) {
    const eqIdx = arg.indexOf('=');
    if (eqIdx < 0) {
      throw new Error(`Invalid --vars format '${arg}'. Expected key=value.`);
    }
    const key = arg.slice(0, eqIdx).trim().toUpperCase();
    const val = arg.slice(eqIdx + 1).trim();
    result[key] = val;
  }
  return result;
}

/**
 * Determine the output file name from the part ID and type.
 */
function outputFileName(partId: string, registryEntry: RegistryEntry | null): string {
  if (partId.startsWith('cap:') && registryEntry) {
    return `composed-${registryEntry.id.replace(/_/g, '-')}.md`;
  }
  if (partId.startsWith('pattern:')) {
    const slug = partId.slice(8);
    return `composed-pattern-${slug}.md`;
  }
  if (partId.startsWith('snippet:')) {
    const slug = partId.slice(8).replace(/:/g, '-');
    return `composed-snippet-${slug}.md`;
  }
  return `composed-${partId.replace(/[^a-z0-9-]/g, '-')}.md`;
}

/**
 * Append a library deviation record to traceability.md in the change directory.
 * If traceability.md does not exist, creates a minimal stub with just the deviation.
 */
function recordProvenance(
  changeDir: string,
  partId: string,
  sourcePath: string,
  version: string,
  outputFile: string,
  vars: VarMap
): void {
  const traceabilityPath = path.join(changeDir, 'traceability.md');
  const timestamp = new Date().toISOString();

  const deviationRecord = [
    '',
    `### Library Composition: ${partId}`,
    '',
    `- **source:** \`${sourcePath}\``,
    `- **version_at_instantiation:** ${version}`,
    `- **output_file:** \`${outputFile}\``,
    `- **vars:** ${Object.keys(vars).length > 0 ? JSON.stringify(vars) : 'none'}`,
    `- **composed_at:** ${timestamp}`,
    `- **deviations:** none (clean instantiation)`,
    '',
  ].join('\n');

  if (!fs.existsSync(traceabilityPath)) {
    // Create a minimal stub so provenance is not lost
    fs.writeFileSync(
      traceabilityPath,
      [
        '# Traceability',
        '',
        '<!-- Auto-generated by /sds:compose-from-library — extend with /sds:traceability-check -->',
        '',
        '## Library Deviations',
        deviationRecord,
      ].join('\n'),
      'utf-8'
    );
  } else {
    const existing = fs.readFileSync(traceabilityPath, 'utf-8');
    if (existing.includes('## Library Deviations')) {
      // Append after the section header
      const updated = existing.replace(
        /## Library Deviations/,
        `## Library Deviations\n${deviationRecord}`
      );
      fs.writeFileSync(traceabilityPath, updated, 'utf-8');
    } else {
      // Append section at end
      fs.writeFileSync(
        traceabilityPath,
        `${existing}\n## Library Deviations\n${deviationRecord}`,
        'utf-8'
      );
    }
  }
}

// -----------------------------------------------------------------------------
// Command Implementation
// -----------------------------------------------------------------------------

export async function sdsComposeFromLibraryCommand(
  partId: string | undefined,
  options: ComposeFromLibraryOptions
): Promise<void> {
  if (!partId) {
    throw new Error(
      `Missing required argument <part-id>.\n` +
        `Valid prefixes: cap:<capability-id>, pattern:<slug>, snippet:<file>\n` +
        `Example: openspec sds compose-from-library cap:human_approval_gate --vars RISK_THRESHOLD=high`
    );
  }

  const hasPrefix = VALID_PART_PREFIXES.some((p) => partId.startsWith(p));
  if (!hasPrefix) {
    throw new Error(
      `Part ID '${partId}' must start with one of: ${VALID_PART_PREFIXES.join(', ')}\n` +
        `Examples:\n` +
        `  cap:human_approval_gate\n` +
        `  pattern:human-in-the-loop\n` +
        `  snippet:requirement-snippets`
    );
  }

  const vars = parseVars(options.vars ?? []);
  const spinner = ora(`Resolving library part '${partId}'...`).start();

  try {
    const projectRoot = process.cwd();
    const changeName = await validateChangeExists(options.change, projectRoot);
    loadChangeContext(projectRoot, changeName); // validate change is readable
    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);
    const libraryRoot = path.join(projectRoot, 'openspec', 'library');

    const resolved = resolveLibraryPart(libraryRoot, partId);
    if (!resolved) {
      spinner.fail(`Library part '${partId}' not found.`);
      throw new Error(
        `No library part found for '${partId}'.\n` +
          `Check 'openspec/library/capability/registry.yaml' or 'openspec/library/patterns/'.`
      );
    }

    const { templateContent, sourcePath, registryEntry } = resolved;
    const { content: substituted, unfilled } = substituteVars(templateContent, vars);
    const outFile = outputFileName(partId, registryEntry);
    const outPath = path.join(changeDir, outFile);
    const version = registryEntry?.version ?? '1.0.0';

    if (options.dryRun) {
      spinner.info(`[dry-run] Would write to: openspec/changes/${changeName}/${outFile}`);
      if (unfilled.length > 0) {
        console.log(`\nUnfilled placeholders: ${unfilled.join(', ')}`);
        console.log(`Use --vars to supply values: ${unfilled.map((k) => `${k}=<value>`).join(' ')}`);
      }
      console.log('\n--- Output preview ---');
      console.log(substituted);
      return;
    }

    fs.writeFileSync(outPath, substituted, 'utf-8');
    recordProvenance(changeDir, partId, sourcePath, version, outFile, vars);

    spinner.succeed(`Composed '${partId}' → openspec/changes/${changeName}/${outFile}`);

    if (unfilled.length > 0) {
      console.log(`\nUnfilled placeholders (fill before use):`);
      unfilled.forEach((k) => console.log(`  {{${k}}}`));
    }

    console.log(`\nProvenance recorded in: openspec/changes/${changeName}/traceability.md`);
    console.log(
      `Tip: After filling placeholders, run 'openspec sds traceability-check' to link this artifact into the change traceability graph.`
    );
  } catch (error) {
    spinner.fail(`Failed to compose library part '${partId}'`);
    throw error;
  }
}
