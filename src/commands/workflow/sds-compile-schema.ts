/**
 * SDS Compile Schema Command
 *
 * Generates capability.schema.json (JSON Schema draft-07) from capability.yaml.
 * The output is used for:
 *   - Runtime validation in Lighthouse execution envelopes
 *   - LLM structured output validation (OpenAI response_format, Anthropic tool_use)
 *   - IDE schema hints for capability.yaml authoring
 *
 * Output: <change-dir>/generated/capability.schema.json
 */

import ora from 'ora';
import path from 'path';
import * as fs from 'fs';
import { parse as parseYaml } from 'yaml';
import { loadChangeContext } from '../../core/artifact-graph/index.js';
import { validateChangeExists, resolveCapabilityYaml } from './shared.js';
import {
  parseCapabilityYaml,
  normalizeField,
  type CapabilityYaml,
  type Field,
} from '../../core/capability/schema.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CompileSchemaOptions {
  change?: string;
  dryRun?: boolean;
  force?: boolean;
}

type JsonSchemaType = 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object' | 'null';

interface JsonSchemaProperty {
  type?: JsonSchemaType | JsonSchemaType[];
  description?: string;
  enum?: unknown[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  oneOf?: JsonSchemaProperty[];
  $ref?: string;
}

interface JsonSchema {
  $schema: string;
  title: string;
  description: string;
  type: 'object';
  required: string[];
  properties: Record<string, JsonSchemaProperty>;
  additionalProperties: boolean;
  'x-capability-id': string;
  'x-capability-version': string;
  'x-generated-by': string;
  'x-generated-at': string;
}

// -----------------------------------------------------------------------------
// Type conversion
// -----------------------------------------------------------------------------

function sdsTypeToJsonSchema(typeStr: string): JsonSchemaProperty {
  const normalized = typeStr.trim().toLowerCase();

  const simpleMap: Record<string, JsonSchemaProperty> = {
    string: { type: 'string' },
    str: { type: 'string' },
    int: { type: 'integer' },
    integer: { type: 'integer' },
    float: { type: 'number' },
    number: { type: 'number' },
    bool: { type: 'boolean' },
    boolean: { type: 'boolean' },
    'list[string]': { type: 'array', items: { type: 'string' } },
    'list[int]': { type: 'array', items: { type: 'integer' } },
    'record': { type: 'object', additionalProperties: true },
  };

  if (simpleMap[normalized]) return simpleMap[normalized];

  // enum[val1, val2, ...]
  const enumMatch = typeStr.match(/^enum\[(.+)\]$/i);
  if (enumMatch) {
    const values = enumMatch[1].split(',').map((v) => v.trim());
    return { type: 'string', enum: values };
  }

  // list[SomeType]
  const listMatch = typeStr.match(/^list\[(.+)\]$/i);
  if (listMatch) {
    return { type: 'array', items: sdsTypeToJsonSchema(listMatch[1]) };
  }

  // Default: treat as string with a note
  return { type: 'string', description: `SDS type: ${typeStr}` };
}

function fieldsToJsonSchemaProperties(fields: Field[]): {
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
} {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const f of fields) {
    const norm = normalizeField(f);
    const prop = sdsTypeToJsonSchema(norm.type);
    if (norm.description) prop.description = norm.description;
    properties[norm.name] = prop;
    if (norm.required) required.push(norm.name);
  }

  return { properties, required };
}

// -----------------------------------------------------------------------------
// JSON Schema builder
// -----------------------------------------------------------------------------

function buildJsonSchema(cap: CapabilityYaml): JsonSchema {
  const { properties: inputProps, required: inputRequired } = fieldsToJsonSchemaProperties(
    cap.inputs
  );
  const { properties: outputProps, required: outputRequired } = fieldsToJsonSchemaProperties(
    cap.outputs
  );

  const schemaProperties: Record<string, JsonSchemaProperty> = {};

  if (Object.keys(inputProps).length > 0) {
    schemaProperties['input'] = {
      type: 'object',
      description: 'Input fields for this capability',
      properties: inputProps,
      required: inputRequired,
      additionalProperties: false,
    };
  }

  if (Object.keys(outputProps).length > 0) {
    schemaProperties['output'] = {
      type: 'object',
      description: 'Output fields produced by this capability',
      properties: outputProps,
      required: outputRequired,
      // Allow additional fields: LLM providers and Lighthouse envelopes may wrap
      // outputs with provider-specific metadata that should not fail validation.
      additionalProperties: true,
    };
  }

  // Effects as a structured object
  schemaProperties['effects'] = {
    type: 'object',
    description: 'Effect classification for this capability invocation',
    properties: {
      reversible: { type: 'boolean' },
      external: { type: 'boolean' },
      idempotent: { type: 'boolean' },
      produces_evidence: { type: 'boolean' },
    },
    additionalProperties: false,
  };

  // Guarantees as an array of strings
  if (cap.guarantees.length > 0) {
    schemaProperties['guarantees'] = {
      type: 'array',
      items: { type: 'string' },
      description: 'Invariants that must hold after successful execution',
    };
  }

  const topRequired: string[] = [];
  if (Object.keys(inputProps).length > 0) topRequired.push('input');

  const schema: JsonSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: cap.id,
    description: cap.description.trim(),
    type: 'object',
    required: topRequired,
    properties: schemaProperties,
    additionalProperties: false,
    'x-capability-id': cap.id,
    'x-capability-version': cap.version,
    'x-generated-by': '/sds:compile-schema',
    'x-generated-at': new Date().toISOString(),
  };

  return schema;
}

// -----------------------------------------------------------------------------
// Command Implementation
// -----------------------------------------------------------------------------

export async function sdsCompileSchemaCommand(options: CompileSchemaOptions): Promise<void> {
  const spinner = ora('Reading capability.yaml...').start();

  try {
    const projectRoot = process.cwd();
    const changeName = await validateChangeExists(options.change, projectRoot);
    const context = loadChangeContext(projectRoot, changeName);
    if (!context.schemaName.startsWith('sds-governed')) {
      spinner.warn(`compile-schema is intended for governed-tier changes (schema: ${context.schemaName}).`);
      console.log(`Proceeding anyway — no capability.yaml may be present.`);
    }
    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);
    const { filePath: capabilityPath, source } = resolveCapabilityYaml(projectRoot, changeName);
    if (source === 'specs') {
      console.log(`Note: reading capability.yaml from promoted location (openspec/specs/${changeName}/)`);
    }

    const raw = parseYaml(fs.readFileSync(capabilityPath, 'utf-8'));
    const capability = parseCapabilityYaml(raw);
    const schema = buildJsonSchema(capability);

    const generatedDir = path.join(changeDir, 'generated');
    const outFile = 'capability.schema.json';
    const outPath = path.join(generatedDir, outFile);
    const outRelative = `openspec/changes/${changeName}/generated/${outFile}`;

    spinner.stop();

    if (options.dryRun) {
      console.log(`[dry-run] Would write: ${outRelative}`);
      console.log('\n--- JSON Schema preview ---');
      console.log(JSON.stringify(schema, null, 2));
      return;
    }

    if (!options.force && fs.existsSync(outPath)) {
      console.log(`Skipped: ${outRelative} (use --force to overwrite)`);
      return;
    }

    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    fs.writeFileSync(outPath, JSON.stringify(schema, null, 2) + '\n', 'utf-8');
    console.log(`Generated: ${outRelative}`);
    console.log(`\nUse cases:`);
    console.log(`  - Lighthouse envelope: validate structured outputs against this schema`);
    console.log(`  - LLM tool_use: pass as response_format.json_schema.schema`);
    console.log(`  - IDE hint: add "$schema" reference to capability.yaml`);
  } catch (error) {
    spinner.fail('compile-schema failed');
    throw error;
  }
}
