/**
 * SDS New Change Command
 *
 * Creates a new SDS change directory with a tier-appropriate workflow schema.
 * The --tier flag maps to the corresponding sds-<tier> schema name.
 */

import ora from 'ora';
import path from 'path';
import { promises as fs } from 'fs';
import { createChange, validateChangeName } from '../../utils/change-utils.js';
import { validateSchemaExists } from './shared.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type SdsTier = 'lean' | 'standard' | 'brownfield' | 'governed';

export interface SdsNewChangeOptions {
  tier?: SdsTier;
  description?: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const TIER_TO_SCHEMA: Record<SdsTier, string> = {
  lean: 'sds-lean',
  standard: 'sds-standard',
  brownfield: 'sds-brownfield',
  governed: 'sds-governed',
};

const VALID_TIERS = Object.keys(TIER_TO_SCHEMA) as SdsTier[];

// -----------------------------------------------------------------------------
// Command Implementation
// -----------------------------------------------------------------------------

export async function sdsNewChangeCommand(
  name: string | undefined,
  options: SdsNewChangeOptions
): Promise<void> {
  if (!name) {
    throw new Error('Missing required argument <name>');
  }

  const validation = validateChangeName(name);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const tier: SdsTier = options.tier ?? 'lean';

  if (!VALID_TIERS.includes(tier)) {
    throw new Error(`Invalid tier '${tier}'. Valid tiers: ${VALID_TIERS.join(', ')}`);
  }

  const schema = TIER_TO_SCHEMA[tier];
  const projectRoot = process.cwd();

  validateSchemaExists(schema, projectRoot);

  const spinner = ora(`Creating SDS ${tier}-tier change '${name}'...`).start();

  try {
    const result = await createChange(projectRoot, name, { schema });

    if (options.description) {
      const changeDir = path.join(projectRoot, 'openspec', 'changes', name);
      const readmePath = path.join(changeDir, 'README.md');
      await fs.writeFile(readmePath, `# ${name}\n\n${options.description}\n`, 'utf-8');
    }

    spinner.succeed(
      `Created ${tier}-tier change '${name}' at openspec/changes/${name}/ (schema: ${result.schema})`
    );
    console.log(`\nNext steps:`);
    console.log(`  openspec instructions proposal --change ${name}`);
    if (tier === 'governed') {
      console.log(`  openspec instructions capability --change ${name}`);
      console.log(`  openspec instructions controls --change ${name}`);
    }
  } catch (error) {
    spinner.fail(`Failed to create change '${name}'`);
    throw error;
  }
}
