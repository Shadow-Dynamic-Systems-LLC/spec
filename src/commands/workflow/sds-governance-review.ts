/**
 * SDS Governance Review Command
 *
 * Outputs a scoped review session for an AI persona role. Each role receives
 * only its owned artifacts and the checklist that governs its review pass.
 *
 * At governed tier, Governor and Verifier must be run as context-isolated
 * invocations — this command warns when that isolation cannot be guaranteed.
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

export type ReviewRole = 'analyst' | 'pm' | 'architect' | 'governor' | 'verifier';

export interface GovernanceReviewOptions {
  change?: string;
  role: ReviewRole;
  json?: boolean;
}

type Tier = SdsTier | 'unknown';

// -----------------------------------------------------------------------------
// Role Definitions
// -----------------------------------------------------------------------------

interface RoleDefinition {
  name: string;
  responsibility: string;
  ownedArtifacts: string[];
  dependsOn: string[];
  checklist: string;
  requiresIsolation: boolean;
}

const ROLE_DEFINITIONS: Record<ReviewRole, RoleDefinition> = {
  analyst: {
    name: 'Analyst',
    responsibility: 'Context, problem framing, brownfield discovery',
    ownedArtifacts: ['brief.md'],
    dependsOn: ['proposal.md'],
    checklist: 'library/checklists/brownfield-checklist.md',
    requiresIsolation: false,
  },
  pm: {
    name: 'PM',
    responsibility: 'Requirements, scope, acceptance outcomes',
    ownedArtifacts: ['prd.md'],
    dependsOn: ['brief.md', 'brownfield-notes.md'],
    checklist: '',
    requiresIsolation: false,
  },
  architect: {
    name: 'Architect',
    responsibility: 'Topology, interfaces, dependencies, tradeoffs',
    ownedArtifacts: ['architecture.md'],
    dependsOn: ['prd.md'],
    checklist: '',
    requiresIsolation: false,
  },
  governor: {
    name: 'Governor',
    responsibility: 'Controls, policy boundaries, exception handling',
    ownedArtifacts: ['controls.md', 'risk.md'],
    dependsOn: ['prd.md', 'architecture.md', 'capability.yaml'],
    checklist: 'library/checklists/control-validation-checklist.md',
    requiresIsolation: true,
  },
  verifier: {
    name: 'Verifier',
    responsibility: 'Testability, evidence, traceability, simulation review',
    ownedArtifacts: ['validation.md', 'traceability.md', 'simulation.md'],
    dependsOn: ['controls.md', 'risk.md', 'capability_surface.md'],
    checklist: 'library/checklists/regulated-release-checklist.md',
    requiresIsolation: true,
  },
};

const VALID_ROLES = Object.keys(ROLE_DEFINITIONS) as ReviewRole[];

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

function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function checkArtifactExists(changeDir: string, filename: string): boolean {
  return fs.existsSync(path.join(changeDir, filename));
}

// -----------------------------------------------------------------------------
// Command Implementation
// -----------------------------------------------------------------------------

export async function sdsGovernanceReviewCommand(options: GovernanceReviewOptions): Promise<void> {
  if (!VALID_ROLES.includes(options.role)) {
    throw new Error(`Invalid role '${options.role}'. Valid roles: ${VALID_ROLES.join(', ')}`);
  }

  const spinner = ora('Preparing governance review...').start();

  try {
    const projectRoot = process.cwd();
    const changeName = await validateChangeExists(options.change, projectRoot);
    const context = loadChangeContext(projectRoot, changeName);
    const tier = tierFromSchema(context.schemaName);
    const roleDef = ROLE_DEFINITIONS[options.role];
    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);

    spinner.stop();

    if (options.json) {
      const result = buildReviewContext(projectRoot, changeDir, changeName, context.schemaName, tier, options.role, roleDef);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    printReviewSession(projectRoot, changeDir, changeName, context.schemaName, tier, options.role, roleDef);
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

interface ReviewContext {
  change: string;
  schema: string;
  tier: string;
  role: string;
  roleKey: ReviewRole;
  isolationRequired: boolean;
  ownedArtifacts: Array<{ file: string; exists: boolean }>;
  dependencyArtifacts: Array<{ file: string; exists: boolean }>;
  checklist: string | null;
}

function buildReviewContext(
  projectRoot: string,
  changeDir: string,
  changeName: string,
  schemaName: string,
  tier: Tier,
  roleKey: ReviewRole,
  roleDef: RoleDefinition
): ReviewContext {
  const checklistPath = roleDef.checklist
    ? path.join(projectRoot, 'openspec', roleDef.checklist)
    : null;

  return {
    change: changeName,
    schema: schemaName,
    tier,
    role: roleDef.name,
    roleKey,
    isolationRequired: roleDef.requiresIsolation && tier === 'governed',
    ownedArtifacts: roleDef.ownedArtifacts.map((f) => ({
      file: f,
      exists: checkArtifactExists(changeDir, f),
    })),
    dependencyArtifacts: roleDef.dependsOn.map((f) => ({
      file: f,
      exists: checkArtifactExists(changeDir, f),
    })),
    checklist: checklistPath ? readFileIfExists(checklistPath) : null,
  };
}

function printReviewSession(
  projectRoot: string,
  changeDir: string,
  changeName: string,
  schemaName: string,
  tier: Tier,
  roleKey: ReviewRole,
  roleDef: RoleDefinition
): void {
  const isolationRequired = roleDef.requiresIsolation && tier === 'governed';

  console.log(`<governance_review role="${roleDef.name}" role_key="${roleKey}" change="${changeName}" tier="${tier}">`);
  console.log();

  // Isolation warning — must be first, most visible
  if (isolationRequired) {
    console.log('<isolation_required>');
    console.log(`IMPORTANT: The ${roleDef.name} role at governed tier MUST be executed as a`);
    console.log('context-isolated invocation. This means:');
    console.log('  - Start a fresh session with no prior conversation history');
    console.log('  - Load only the artifacts listed in <dependencies> below');
    console.log('  - Do not carry findings or context from other role review passes');
    console.log('  - Produce a signed, timestamped review artifact recording your findings');
    console.log('</isolation_required>');
    console.log();
  }

  // Role scope
  console.log('<role>');
  console.log(`Name: ${roleDef.name}`);
  console.log(`Responsibility: ${roleDef.responsibility}`);
  console.log('</role>');
  console.log();

  // Owned artifacts (what this role produces/reviews)
  console.log('<owned_artifacts>');
  console.log('You are responsible for reviewing and accepting these artifacts:');
  for (const artifactFile of roleDef.ownedArtifacts) {
    const exists = checkArtifactExists(changeDir, artifactFile);
    const status = exists ? 'exists' : 'missing';
    const fullPath = path.join(changeDir, artifactFile);
    console.log(`  <artifact file="${artifactFile}" status="${status}">`);
    console.log(`    <path>${fullPath}</path>`);
    console.log(`  </artifact>`);
  }
  console.log('</owned_artifacts>');
  console.log();

  // Dependencies
  const missingDeps = roleDef.dependsOn.filter((f) => !checkArtifactExists(changeDir, f));
  if (missingDeps.length > 0) {
    console.log('<warning>');
    console.log(`Missing dependency artifacts: ${missingDeps.join(', ')}`);
    console.log('These must exist before this review pass can be completed.');
    console.log('</warning>');
    console.log();
  }

  console.log('<dependencies>');
  console.log('Read these files for context. Do NOT modify them — they are owned by other roles:');
  for (const depFile of roleDef.dependsOn) {
    const exists = checkArtifactExists(changeDir, depFile);
    const status = exists ? 'exists' : 'missing';
    const fullPath = path.join(changeDir, depFile);
    console.log(`  <dependency file="${depFile}" status="${status}">`);
    console.log(`    <path>${fullPath}</path>`);
    console.log(`  </dependency>`);
  }
  console.log('</dependencies>');
  console.log();

  // Checklist
  if (roleDef.checklist) {
    const checklistPath = path.join(projectRoot, 'openspec', roleDef.checklist);
    const checklistContent = readFileIfExists(checklistPath);
    if (checklistContent) {
      console.log('<checklist>');
      console.log(checklistContent.trim());
      console.log('</checklist>');
      console.log();
    } else {
      console.log('<checklist_missing>');
      console.log(`Checklist not found at: ${checklistPath}`);
      console.log('Run "openspec sds governance-review" from the project root.');
      console.log('</checklist_missing>');
      console.log();
    }
  }

  // Review artifact instruction
  console.log('<review_artifact_instruction>');
  console.log('After completing your review, produce a review artifact with:');
  console.log(`  - role: ${roleDef.name}`);
  console.log(`  - change: ${changeName}`);
  console.log(`  - artifacts_reviewed: ${roleDef.ownedArtifacts.join(', ')}`);
  console.log('  - checklist_items: [list each item with pass/fail/finding]');
  console.log('  - determination: PASS | FAIL | PASS_WITH_FINDINGS');
  console.log('  - findings: [list any issues requiring action before approval]');
  console.log('  - timestamp: [ISO8601]');
  if (isolationRequired) {
    console.log('This artifact MUST be produced before sharing context with other roles.');
  }
  console.log('</review_artifact_instruction>');
  console.log();

  console.log('</governance_review>');
}
