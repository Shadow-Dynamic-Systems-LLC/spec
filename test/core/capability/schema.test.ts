import { describe, it, expect } from 'vitest';
import {
  parseCapabilityYaml,
  safeParseCapabilityYaml,
  normalizeField,
  type CapabilityYaml,
  type Field,
} from '../../../src/core/capability/schema.js';

describe('capability schema', () => {
  describe('parseCapabilityYaml', () => {
    it('parses a fully valid capability.yaml object with all fields', () => {
      const validCapability = {
        id: 'human_approval_gate',
        kind: 'capability',
        version: '1.2.3',
        description: 'Gates deployment pending human approval',
        inputs: [
          { name: 'request_id', type: 'string', required: true },
          'deployment_target: string',
        ],
        outputs: [
          { name: 'approved', type: 'boolean', required: true, description: 'Whether approved' },
          'approval_timestamp: datetime',
        ],
        preconditions: [
          'User has approval permission',
          'Deployment target is valid',
        ],
        effects: {
          reversible: false,
          external: true,
          idempotent: true,
          produces_evidence: true,
        },
        composability: {
          compatible_with: ['cost_gate', 'security_scan'],
          conflicts_with: ['auto_deploy'],
          requires_before: ['security_scan'],
          requires_after: ['cost_gate'],
        },
        guarantees: [
          'All approved deployments are logged',
          'Rejected requests cannot proceed',
        ],
        baml_binding: {
          function: 'HumanApprovalGate',
          auto_generate: true,
          test_inputs: [
            { request_id: 'req-123', deployment_target: 'staging' },
            { request_id: 'req-456', deployment_target: 'production' },
          ],
        },
        tags: ['governance', 'deployment'],
        validation: {
          hash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
          verified_at: '2023-01-01T12:00:00Z',
          verified_version: '1.2.3',
        },
      };

      const result = parseCapabilityYaml(validCapability);
      expect(result).toEqual({
        id: 'human_approval_gate',
        kind: 'capability',
        version: '1.2.3',
        description: 'Gates deployment pending human approval',
        inputs: [
          { name: 'request_id', type: 'string', required: true },
          'deployment_target: string',
        ],
        outputs: [
          { name: 'approved', type: 'boolean', required: true, description: 'Whether approved' },
          'approval_timestamp: datetime',
        ],
        preconditions: [
          'User has approval permission',
          'Deployment target is valid',
        ],
        effects: {
          reversible: false,
          external: true,
          idempotent: true,
          produces_evidence: true,
        },
        composability: {
          compatible_with: ['cost_gate', 'security_scan'],
          conflicts_with: ['auto_deploy'],
          requires_before: ['security_scan'],
          requires_after: ['cost_gate'],
        },
        guarantees: [
          'All approved deployments are logged',
          'Rejected requests cannot proceed',
        ],
        baml_binding: {
          function: 'HumanApprovalGate',
          auto_generate: true,
          test_inputs: [
            { request_id: 'req-123', deployment_target: 'staging' },
            { request_id: 'req-456', deployment_target: 'production' },
          ],
        },
        tags: ['governance', 'deployment'],
        validation: {
          hash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
          verified_at: '2023-01-01T12:00:00Z',
          verified_version: '1.2.3',
        },
      });
    });

    it('rejects missing id', () => {
      const invalidCapability = {
        version: '1.0.0',
        description: 'Test capability',
        guarantees: ['Test guarantee'],
      };

      expect(() => parseCapabilityYaml(invalidCapability)).toThrow();
    });

    it('rejects non-snake_case id', () => {
      const invalidCapability = {
        id: 'MyCapability', // Should be my_capability
        version: '1.0.0',
        description: 'Test capability',
        guarantees: ['Test guarantee'],
      };

      expect(() => parseCapabilityYaml(invalidCapability)).toThrow();
    });

    it('rejects id starting with number', () => {
      const invalidCapability = {
        id: '123_capability',
        version: '1.0.0',
        description: 'Test capability',
        guarantees: ['Test guarantee'],
      };

      expect(() => parseCapabilityYaml(invalidCapability)).toThrow();
    });

    it('rejects id with uppercase letters', () => {
      const invalidCapability = {
        id: 'CAPABILITY_NAME',
        version: '1.0.0',
        description: 'Test capability',
        guarantees: ['Test guarantee'],
      };

      expect(() => parseCapabilityYaml(invalidCapability)).toThrow();
    });

    it('rejects non-semver version', () => {
      const invalidCapability = {
        id: 'test_capability',
        version: 'v1.0', // Should be 1.0.0
        description: 'Test capability',
        guarantees: ['Test guarantee'],
      };

      expect(() => parseCapabilityYaml(invalidCapability)).toThrow();
    });

    it('rejects version with pre-release suffix', () => {
      const invalidCapability = {
        id: 'test_capability',
        version: '1.0.0-alpha', // Should be strict semver
        description: 'Test capability',
        guarantees: ['Test guarantee'],
      };

      expect(() => parseCapabilityYaml(invalidCapability)).toThrow();
    });

    it('rejects non-PascalCase baml_binding.function', () => {
      const invalidCapability = {
        id: 'test_capability',
        version: '1.0.0',
        description: 'Test capability',
        guarantees: ['Test guarantee'],
        baml_binding: {
          function: 'testFunction', // Should be TestFunction
        },
      };

      expect(() => parseCapabilityYaml(invalidCapability)).toThrow();
    });

    it('rejects baml_binding.function that starts lowercase', () => {
      const invalidCapability = {
        id: 'test_capability',
        version: '1.0.0',
        description: 'Test capability',
        guarantees: ['Test guarantee'],
        baml_binding: {
          function: 'testFunction', // Should be TestFunction
        },
      };

      expect(() => parseCapabilityYaml(invalidCapability)).toThrow();
    });

    it('accepts valid PascalCase baml_binding.function', () => {
      const validCapability = {
        id: 'test_capability',
        version: '1.0.0',
        description: 'Test capability',
        guarantees: ['Test guarantee'],
        baml_binding: {
          function: 'TestFunction',
        },
      };

      const result = parseCapabilityYaml(validCapability);
      expect(result.baml_binding?.function).toBe('TestFunction');
    });

    it('rejects malformed validation.hash (not 64 hex chars)', () => {
      const invalidCapability = {
        id: 'test_capability',
        version: '1.0.0',
        description: 'Test capability',
        guarantees: ['Test guarantee'],
        validation: {
          hash: 'abc123', // Should be 64 hex chars
        },
      };

      expect(() => parseCapabilityYaml(invalidCapability)).toThrow();
    });

    it('rejects validation.hash with uppercase letters', () => {
      const invalidCapability = {
        id: 'test_capability',
        version: '1.0.0',
        description: 'Test capability',
        guarantees: ['Test guarantee'],
        validation: {
          hash: 'A1B2C3D4E5F6789012345678901234567890ABCDEF1234567890ABCDEF123456', // Should be lowercase
        },
      };

      expect(() => parseCapabilityYaml(invalidCapability)).toThrow();
    });

    it('accepts valid 64-char hex validation.hash', () => {
      const validCapability = {
        id: 'test_capability',
        version: '1.0.0',
        description: 'Test capability',
        guarantees: ['Test guarantee'],
        validation: {
          hash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
        },
      };

      const result = parseCapabilityYaml(validCapability);
      expect(result.validation?.hash).toBe(
        'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456'
      );
    });

    it('allows external: true with produces_evidence: false', () => {
      // Schema validation should allow this - the governance check is in check-drift
      const validCapability = {
        id: 'test_capability',
        version: '1.0.0',
        description: 'Test capability',
        guarantees: ['Test guarantee'],
        effects: {
          external: true,
          produces_evidence: false,
        },
      };

      const result = parseCapabilityYaml(validCapability);
      expect(result.effects.external).toBe(true);
      expect(result.effects.produces_evidence).toBe(false);
    });

    it('rejects empty guarantees array', () => {
      const invalidCapability = {
        id: 'test_capability',
        version: '1.0.0',
        description: 'Test capability',
        guarantees: [], // Should have at least one
      };

      expect(() => parseCapabilityYaml(invalidCapability)).toThrow();
    });

    it('rejects missing guarantees field entirely', () => {
      const invalidCapability = {
        id: 'test_capability',
        version: '1.0.0',
        description: 'Test capability',
        // guarantees field is missing
      };

      expect(() => parseCapabilityYaml(invalidCapability)).toThrow();
    });

    it('accepts inline string field format', () => {
      const validCapability = {
        id: 'test_capability',
        version: '1.0.0',
        description: 'Test capability',
        inputs: ['field_name: TypeName'],
        guarantees: ['Test guarantee'],
      };

      const result = parseCapabilityYaml(validCapability);
      expect(result.inputs[0]).toBe('field_name: TypeName');
    });

    it('accepts expanded object field format', () => {
      const validCapability = {
        id: 'test_capability',
        version: '1.0.0',
        description: 'Test capability',
        inputs: [
          {
            name: 'field_name',
            type: 'TypeName',
            description: 'Field description',
            required: false,
          },
        ],
        guarantees: ['Test guarantee'],
      };

      const result = parseCapabilityYaml(validCapability);
      expect(result.inputs[0]).toEqual({
        name: 'field_name',
        type: 'TypeName',
        description: 'Field description',
        required: false,
      });
    });

    it('accepts field with colon in value (URL example)', () => {
      const validCapability = {
        id: 'test_capability',
        version: '1.0.0',
        description: 'Test capability',
        inputs: ['url: https://example.com'],
        guarantees: ['Test guarantee'],
      };

      const result = parseCapabilityYaml(validCapability);
      expect(result.inputs[0]).toBe('url: https://example.com');
    });

    it('sets default values for optional fields', () => {
      const minimalCapability = {
        id: 'minimal_capability',
        version: '1.0.0',
        description: 'Minimal test capability',
        guarantees: ['At least one guarantee required'],
      };

      const result = parseCapabilityYaml(minimalCapability);
      expect(result.kind).toBe('capability');
      expect(result.inputs).toEqual([]);
      expect(result.outputs).toEqual([]);
      expect(result.preconditions).toEqual([]);
      expect(result.effects).toEqual({
        reversible: false,
        external: false,
        idempotent: false,
        produces_evidence: false,
      });
      expect(result.composability).toEqual({
        compatible_with: [],
        conflicts_with: [],
        requires_before: [],
        requires_after: [],
      });
      expect(result.tags).toEqual([]);
    });
  });

  describe('safeParseCapabilityYaml', () => {
    it('returns { success: true } for valid input', () => {
      const validCapability = {
        id: 'test_capability',
        version: '1.0.0',
        description: 'Test capability',
        guarantees: ['Test guarantee'],
      };

      const result = safeParseCapabilityYaml(validCapability);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('test_capability');
      }
    });

    it('returns { success: false } instead of throwing for invalid input', () => {
      const invalidCapability = {
        id: 'InvalidName', // Should be snake_case
        version: '1.0.0',
        description: 'Test capability',
        guarantees: ['Test guarantee'],
      };

      const result = safeParseCapabilityYaml(invalidCapability);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('returns detailed error information', () => {
      const invalidCapability = {
        id: 'test_capability',
        version: 'invalid-version',
        description: 'Test capability',
        guarantees: [],
      };

      const result = safeParseCapabilityYaml(invalidCapability);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toBeDefined();
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('normalizeField', () => {
    it('normalizes inline string "my_field: string" to expanded form', () => {
      const field: Field = 'my_field: string';
      const result = normalizeField(field);
      expect(result).toEqual({
        name: 'my_field',
        type: 'string',
        required: true,
      });
    });

    it('handles URL with colon in value correctly', () => {
      const field: Field = 'url: https://example.com';
      const result = normalizeField(field);
      expect(result).toEqual({
        name: 'url',
        type: 'https://example.com',
        required: true,
      });
    });

    it('handles field with spaces around colon', () => {
      const field: Field = 'field_name : TypeName';
      const result = normalizeField(field);
      expect(result).toEqual({
        name: 'field_name',
        type: 'TypeName',
        required: true,
      });
    });

    it('preserves expanded object form with required: false', () => {
      const field: Field = {
        name: 'optional_field',
        type: 'int',
        description: 'An optional field',
        required: false,
      };
      const result = normalizeField(field);
      expect(result).toEqual({
        name: 'optional_field',
        type: 'int',
        description: 'An optional field',
        required: false,
      });
    });

    it('preserves expanded object form with required: true', () => {
      const field: Field = {
        name: 'required_field',
        type: 'string',
        required: true,
      };
      const result = normalizeField(field);
      expect(result).toEqual({
        name: 'required_field',
        type: 'string',
        required: true,
      });
    });

    it('handles expanded object without required field (defaults to true after Zod parse)', () => {
      // Note: This test represents the state AFTER Zod parsing.
      // Zod's .default(true) ensures required is always present after parsing.
      const field: Field = {
        name: 'field_without_required',
        type: 'boolean',
        required: true, // Would be set by Zod default
      };
      const result = normalizeField(field);
      expect(result).toEqual({
        name: 'field_without_required',
        type: 'boolean',
        required: true,
      });
    });

    it('handles expanded object with description', () => {
      const field: Field = {
        name: 'documented_field',
        type: 'string',
        description: 'A well documented field',
        required: true,
      };
      const result = normalizeField(field);
      expect(result).toEqual({
        name: 'documented_field',
        type: 'string',
        description: 'A well documented field',
        required: true,
      });
    });

    it('handles complex type names in inline format', () => {
      const field: Field = 'complex_field: Map<string, Array<number>>';
      const result = normalizeField(field);
      expect(result).toEqual({
        name: 'complex_field',
        type: 'Map<string, Array<number>>',
        required: true,
      });
    });
  });
});