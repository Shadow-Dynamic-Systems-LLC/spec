/**
 * Zod schema for capability.yaml
 *
 * Validates the machine-readable capability descriptor used by SDS-Spec governed-tier
 * changes. Consumed by:
 *   - /sds:compile-baml   → generates BAML function stubs
 *   - /sds:compile-schema → generates JSON Schema for runtime validation
 *   - /sds:check-drift    → validates runtime output hash against validation.hash
 *   - /sds:compute-surface → reads composability graph
 */

import { z } from 'zod';

// -----------------------------------------------------------------------------
// Field-level schemas
// -----------------------------------------------------------------------------

/**
 * A typed input or output field.
 * Inline format: `field_name: TypeName`
 * Expanded format: { name, type, description, required }
 */
const FieldSchema = z.union([
  // Expanded object form
  z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    description: z.string().optional(),
    required: z.boolean().default(true),
  }),
  // Inline string form: "field_name: TypeName"
  z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*\s*:\s*.+$/, {
    message: 'Inline field must be "field_name: TypeName"',
  }),
]);

export type Field = z.infer<typeof FieldSchema>;

/**
 * Effects block — what the capability does to the world.
 */
const EffectsSchema = z.object({
  reversible: z.boolean().default(false),
  external: z.boolean().default(false),
  idempotent: z.boolean().default(false),
  produces_evidence: z.boolean().default(false),
});

export type Effects = z.infer<typeof EffectsSchema>;

/**
 * Composability block — how this capability may be combined.
 * IDs here are snake_case primitive capability IDs (e.g., audit_log).
 */
const ComposabilitySchema = z.object({
  compatible_with: z.array(z.string()).default([]),
  conflicts_with: z.array(z.string()).default([]),
  requires_before: z.array(z.string()).default([]),
  requires_after: z.array(z.string()).default([]),
});

export type Composability = z.infer<typeof ComposabilitySchema>;

/**
 * BAML binding — links this capability to a BAML function.
 */
const BamlBindingSchema = z.object({
  /** Target BAML function name (PascalCase). Required. */
  function: z.string().regex(/^[A-Z][A-Za-z0-9]*$/, {
    message: 'BAML function name must be PascalCase (e.g., HumanApprovalGate)',
  }),
  /** If true, /sds:compile-baml generates a stub. */
  auto_generate: z.boolean().default(false),
  /**
   * Canonical test inputs for /sds:check-drift.
   * Each entry is a key-value map of input fields.
   */
  test_inputs: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, { message: 'At least one test_inputs entry required for drift checking' })
    .optional(),
});

export type BamlBinding = z.infer<typeof BamlBindingSchema>;

/**
 * Validation block — populated by /sds:check-drift after a verified run.
 */
const ValidationSchema = z.object({
  /** SHA-256 hex of the canonical output produced by test_inputs. */
  hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/, { message: 'validation.hash must be a 64-char hex SHA-256' })
    .optional(),
  /** ISO8601 timestamp of the last successful verification. */
  verified_at: z.string().datetime({ offset: true }).optional(),
  /** Version of the capability that produced this hash. */
  verified_version: z.string().optional(),
});

export type Validation = z.infer<typeof ValidationSchema>;

// -----------------------------------------------------------------------------
// Top-level capability.yaml schema
// -----------------------------------------------------------------------------

export const CapabilityYamlSchema = z.object({
  /**
   * Unique identifier — snake_case matching the primitive registry.
   * E.g., human_approval_gate, cost_gate.
   */
  id: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/, { message: 'Capability ID must be snake_case' })
    .min(1),

  /**
   * Kind — always "capability" for primitive capabilities.
   * "composite" for capabilities composed from primitives.
   */
  kind: z.enum(['capability', 'composite']).default('capability'),

  /** Semver string. */
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, { message: 'Version must be semver (e.g., 1.0.0)' }),

  /** One-sentence description shown in CAPABILITIES.md. */
  description: z.string().min(1),

  /** Input fields accepted by this capability. */
  inputs: z.array(FieldSchema).default([]),

  /** Output fields produced by this capability. */
  outputs: z.array(FieldSchema).default([]),

  /**
   * Preconditions — invariants that must be true at invocation time.
   * Plain strings; evaluated by documentation/governance tooling.
   */
  preconditions: z.array(z.string()).default([]),

  /** Effect classification. */
  effects: EffectsSchema.default({
    reversible: false,
    external: false,
    idempotent: false,
    produces_evidence: false,
  }),

  /** Composability graph. */
  composability: ComposabilitySchema.default({
    compatible_with: [],
    conflicts_with: [],
    requires_before: [],
    requires_after: [],
  }),

  /**
   * Guarantees — invariants that are always true after successful execution.
   * Plain strings; evaluated by documentation/governance tooling.
   * At least one guarantee is required (enforced at schema level).
   * Note: .default([]) is intentionally absent — omitting guarantees is a
   * schema error, not a silent empty list.  check-drift also validates this.
   */
  guarantees: z.array(z.string()).min(1, {
    message: 'At least one guarantee is required in capability.yaml',
  }),

  /** Optional BAML binding for compile-baml and check-drift. */
  baml_binding: BamlBindingSchema.optional(),

  /** Domain tags matching the primitive registry taxonomy. */
  tags: z.array(z.string()).default([]),

  /** Populated by /sds:check-drift after a verified execution run. */
  validation: ValidationSchema.optional(),
});

export type CapabilityYaml = z.infer<typeof CapabilityYamlSchema>;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Parse and validate a raw YAML object as a capability.yaml.
 * Returns a typed CapabilityYaml on success, throws ZodError on failure.
 */
export function parseCapabilityYaml(raw: unknown): CapabilityYaml {
  return CapabilityYamlSchema.parse(raw);
}

/**
 * Safe parse — returns { success, data } | { success: false, error }.
 */
export function safeParseCapabilityYaml(raw: unknown) {
  return CapabilityYamlSchema.safeParse(raw);
}

/**
 * Normalize a Field (inline string or expanded object) to the expanded form.
 * Always safe to call on Zod-parsed values — the Zod schema's .default(true)
 * ensures `required` is always set on expanded form after parsing.
 */
export function normalizeField(field: Field): { name: string; type: string; description?: string; required: boolean } {
  if (typeof field === 'string') {
    const colonIdx = field.indexOf(':');
    return {
      name: field.slice(0, colonIdx).trim(),
      type: field.slice(colonIdx + 1).trim(),
      required: true,
    };
  }
  // Expanded form — `required` is always present after Zod parse (default: true).
  return field as { name: string; type: string; description?: string; required: boolean };
}
