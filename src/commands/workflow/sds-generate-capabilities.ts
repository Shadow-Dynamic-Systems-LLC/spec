/**
 * SDS Generate Capabilities Command
 *
 * Regenerates openspec/library/capability/CAPABILITIES.md from registry.yaml.
 * CAPABILITIES.md is a build artifact — DO NOT edit manually.
 *
 * Run after any change to registry.yaml (new primitive, version bump, deprecation).
 */

import ora from 'ora';
import path from 'path';
import * as fs from 'fs';
import { parse as parseYaml } from 'yaml';

export interface GenerateCapabilitiesOptions {
  dryRun?: boolean;
}

interface RegistryEntry {
  id: string;
  name: string;
  type: string;
  description: string;
  domain_tags: string[];
  version: string;
  status: 'active' | 'deprecated';
  known_dependencies?: string[];
  deprecated_by?: string | null;
}

function buildMarkdown(registry: RegistryEntry[], generatedAt: string): string {
  const active = registry.filter((e) => e.status === 'active');
  const deprecated = registry.filter((e) => e.status === 'deprecated');

  // Domain tag → capability IDs map
  const byTag = new Map<string, string[]>();
  for (const entry of active) {
    for (const tag of entry.domain_tags ?? []) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(`\`${entry.id}\``);
    }
  }
  const sortedTags = [...byTag.keys()].sort();

  // Dependency graph lines
  const depLines: string[] = [];
  for (const entry of active) {
    const deps = entry.known_dependencies ?? [];
    if (deps.length > 0) {
      depLines.push(`${entry.id}`);
      deps.forEach((d) => depLines.push(`  └── requires: ${d}`));
    } else {
      depLines.push(`${entry.id.padEnd(24)} — no dependencies`);
    }
  }

  const lines: string[] = [
    `# SDS Primitive Capability Reference`,
    ``,
    `<!-- BUILD ARTIFACT — generated from library/capability/registry.yaml -->`,
    `<!-- DO NOT EDIT — regenerate with: openspec sds generate-capabilities -->`,
    `<!-- Last generated: ${generatedAt} -->`,
    ``,
    `This table lists all primitive capabilities in the SDS library. For full variable specs, preconditions, and composition notes, consult \`registry.yaml\`.`,
    ``,
    `| ID | Name | Type | Domain Tags | Version | Status |`,
    `|---|---|---|---|---|---|`,
    ...active.map(
      (e) =>
        `| \`${e.id}\` | ${e.name} | ${e.type} | ${(e.domain_tags ?? []).join(', ')} | ${e.version} | ${e.status} |`
    ),
    ``,
    `## Summary by Domain Tag`,
    ``,
    `| Domain Tag | Capabilities |`,
    `|---|---|`,
    ...sortedTags.map((tag) => `| ${tag} | ${byTag.get(tag)!.join(', ')} |`),
    ``,
    `## Known Dependency Graph`,
    ``,
    '```',
    ...depLines,
    '```',
  ];

  if (deprecated.length > 0) {
    lines.push(
      ``,
      `## Deprecated`,
      ``,
      `| ID | Deprecated By | Version |`,
      `|---|---|---|`,
      ...deprecated.map(
        (e) => `| \`${e.id}\` | ${e.deprecated_by ?? '—'} | ${e.version} |`
      )
    );
  }

  return lines.join('\n') + '\n';
}

export async function sdsGenerateCapabilitiesCommand(
  options: GenerateCapabilitiesOptions
): Promise<void> {
  const spinner = ora('Reading capability registry...').start();

  try {
    const projectRoot = process.cwd();
    const registryPath = path.join(
      projectRoot,
      'openspec',
      'library',
      'capability',
      'registry.yaml'
    );
    const outPath = path.join(
      projectRoot,
      'openspec',
      'library',
      'capability',
      'CAPABILITIES.md'
    );

    if (!fs.existsSync(registryPath)) {
      spinner.fail(`Registry not found at: openspec/library/capability/registry.yaml`);
      throw new Error('Run from the project root containing openspec/library/.');
    }

    const registry = parseYaml(fs.readFileSync(registryPath, 'utf-8')) as RegistryEntry[];
    const generatedAt = new Date().toISOString();
    const markdown = buildMarkdown(registry, generatedAt);

    spinner.stop();

    if (options.dryRun) {
      console.log(`[dry-run] Would write: openspec/library/capability/CAPABILITIES.md`);
      console.log(`\n${markdown}`);
      return;
    }

    fs.writeFileSync(outPath, markdown, 'utf-8');
    const active = registry.filter((e) => e.status === 'active').length;
    console.log(
      `Regenerated CAPABILITIES.md — ${active} active primitive(s) from registry.yaml`
    );
  } catch (error) {
    spinner.fail('generate-capabilities failed');
    throw error;
  }
}
