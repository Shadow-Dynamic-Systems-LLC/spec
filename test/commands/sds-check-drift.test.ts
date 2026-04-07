import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { runCLI } from '../helpers/run-cli.js';

describe('sds check-drift command', () => {
  let tempDir: string;
  let changesDir: string;
  let openspecDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sds-check-drift-'));
    openspecDir = path.join(tempDir, 'openspec');
    changesDir = path.join(openspecDir, 'changes');
    await fs.mkdir(changesDir, { recursive: true });
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Gets combined output from CLI result (ora outputs to stdout).
   */
  function getOutput(result: { stdout: string; stderr: string }): string {
    return result.stdout + result.stderr;
  }

  /**
   * Creates a test change directory with .openspec.yaml config.
   */
  async function createTestChange(changeName: string, schema: string = 'sds-governed'): Promise<string> {
    const changeDir = path.join(changesDir, changeName);
    await fs.mkdir(changeDir, { recursive: true });

    // Create .openspec.yaml with the specified schema
    const configContent = `schema: ${schema}\ncreated: "2023-01-01"\n`;
    await fs.writeFile(path.join(changeDir, '.openspec.yaml'), configContent);

    return changeDir;
  }

  /**
   * Creates a valid capability.yaml file in the change directory.
   */
  async function createValidCapability(changeDir: string): Promise<void> {
    const yamlContent = [
      'id: test_capability',
      'version: 1.0.0',
      'description: Test capability for drift checking',
      'guarantees:',
      '  - "All operations are properly logged"',
      '  - "State transitions are validated"',
      'effects:',
      '  external: false',
      '  produces_evidence: true',
      'composability:',
      '  compatible_with:',
      '    - audit_log',
      '  conflicts_with: []',
      'baml_binding:',
      '  function: TestCapability',
      '  test_inputs:',
      '    - input_field: test_value_1',
      '    - input_field: test_value_2',
    ].join('\n');

    await fs.writeFile(path.join(changeDir, 'capability.yaml'), yamlContent);
  }

  describe('missing capability.yaml', () => {
    it('exits non-zero when capability.yaml is missing', async () => {
      const changeDir = await createTestChange('missing-capability');

      const result = await runCLI(['sds', 'check-drift', '--change', 'missing-capability'], {
        cwd: tempDir,
      });
      expect(result.exitCode).toBe(1);

      const output = getOutput(result);
      expect(output).toContain('capability.yaml not found');
      expect(output).toContain('capability.yaml is required');
    });

    it('provides helpful error message about creating capability.yaml', async () => {
      const changeDir = await createTestChange('no-capability');

      const result = await runCLI(['sds', 'check-drift', '--change', 'no-capability'], {
        cwd: tempDir,
      });
      expect(result.exitCode).toBe(1);

      const output = getOutput(result);
      expect(output).toContain("openspec instructions capability");
    });
  });

  describe('guarantees validation', () => {
    it('fails when guarantees contain TODO text', async () => {
      const changeDir = await createTestChange('todo-guarantees');

      const capabilityWithTodo = [
        'id: todo_capability',
        'version: 1.0.0',
        'description: Capability with TODO guarantees',
        'guarantees:',
        '  - "TODO: Add real guarantees here"',
        '  - "This operation is properly validated"',
      ].join('\n');

      await fs.writeFile(path.join(changeDir, 'capability.yaml'), capabilityWithTodo);

      const result = await runCLI(['sds', 'check-drift', '--change', 'todo-guarantees'], {
        cwd: tempDir,
      });
      expect(result.exitCode).toBe(1);

      const output = getOutput(result);
      expect(output).toContain('guarantees_documented');
      expect(output).toContain('TODO/placeholder text');
      expect(output).toContain('TODO: Add real guarantees here');
    });

    it('fails when guarantees contain placeholder text', async () => {
      const changeDir = await createTestChange('placeholder-guarantees');

      const capabilityWithPlaceholder = [
        'id: placeholder_capability',
        'version: 1.0.0',
        'description: Capability with placeholder guarantees',
        'guarantees:',
        '  - "This is a placeholder guarantee"',
        '  - "All operations succeed"',
      ].join('\n');

      await fs.writeFile(path.join(changeDir, 'capability.yaml'), capabilityWithPlaceholder);

      const result = await runCLI(['sds', 'check-drift', '--change', 'placeholder-guarantees'], {
        cwd: tempDir,
      });
      expect(result.exitCode).toBe(1);

      const output = getOutput(result);
      expect(output).toContain('guarantees_documented');
      expect(output).toContain('TODO/placeholder text');
    });
  });

  describe('effects validation', () => {
    it('fails when external capability does not produce evidence', async () => {
      const changeDir = await createTestChange('external-no-evidence');

      const externalCapability = [
        'id: external_capability',
        'version: 1.0.0',
        'description: External capability without evidence',
        'guarantees:',
        '  - "All external calls are validated"',
        'effects:',
        '  external: true',
        '  produces_evidence: false',
      ].join('\n');

      await fs.writeFile(path.join(changeDir, 'capability.yaml'), externalCapability);

      const result = await runCLI(['sds', 'check-drift', '--change', 'external-no-evidence'], {
        cwd: tempDir,
      });
      expect(result.exitCode).toBe(1);

      const output = getOutput(result);
      expect(output).toContain('effects_classified');
      expect(output).toContain('External capability must have effects.produces_evidence: true');
      expect(output).toContain('governance rule #3');
    });

    it('passes when external capability produces evidence', async () => {
      const changeDir = await createTestChange('external-with-evidence');

      const externalCapability = [
        'id: external_with_evidence',
        'version: 1.0.0',
        'description: External capability with evidence',
        'guarantees:',
        '  - "All external calls are validated"',
        'effects:',
        '  external: true',
        '  produces_evidence: true',
      ].join('\n');

      await fs.writeFile(path.join(changeDir, 'capability.yaml'), externalCapability);

      const result = await runCLI(['sds', 'check-drift', '--change', 'external-with-evidence'], {
        cwd: tempDir,
      });

      const output = getOutput(result);
      expect(output).toContain('effects_classified');
      expect(output).toContain('✓');
      // Should pass effects check (though may be blocked on other checks)
    });
  });

  describe('composability validation', () => {
    it('fails when capability is in both compatible_with and conflicts_with', async () => {
      const changeDir = await createTestChange('composability-conflict');

      const conflictingCapability = [
        'id: conflicting_capability',
        'version: 1.0.0',
        'description: Capability with composability conflicts',
        'guarantees:',
        '  - "All operations are validated"',
        'composability:',
        '  compatible_with:',
        '    - audit_log',
        '    - cost_gate',
        '  conflicts_with:',
        '    - cost_gate',
        '    - auto_deploy',
      ].join('\n');

      await fs.writeFile(path.join(changeDir, 'capability.yaml'), conflictingCapability);

      const result = await runCLI(['sds', 'check-drift', '--change', 'composability-conflict'], {
        cwd: tempDir,
      });
      expect(result.exitCode).toBe(1);

      const output = getOutput(result);
      expect(output).toContain('composability_consistency');
      expect(output).toContain('both compatible_with and conflicts_with');
      expect(output).toContain('cost_gate');
    });

    it('passes when composability lists are consistent', async () => {
      const changeDir = await createTestChange('composability-consistent');

      const consistentCapability = [
        'id: consistent_capability',
        'version: 1.0.0',
        'description: Capability with consistent composability',
        'guarantees:',
        '  - "All operations are validated"',
        'composability:',
        '  compatible_with:',
        '    - audit_log',
        '    - security_scan',
        '  conflicts_with:',
        '    - auto_deploy',
        '    - bypass_approval',
      ].join('\n');

      await fs.writeFile(path.join(changeDir, 'capability.yaml'), consistentCapability);

      const result = await runCLI(['sds', 'check-drift', '--change', 'composability-consistent'], {
        cwd: tempDir,
      });

      const output = getOutput(result);
      expect(output).toContain('composability_consistency');
      expect(output).toContain('✓');
      // Should pass composability check (though may be blocked on other checks)
    });
  });

  describe('JSON output', () => {
    it('outputs valid JSON with --json flag', async () => {
      const changeDir = await createTestChange('json-output');
      await createValidCapability(changeDir);

      const result = await runCLI(['sds', 'check-drift', '--change', 'json-output', '--json'], {
        cwd: tempDir,
      });

      // Should produce valid JSON regardless of pass/fail/blocked status
      expect(() => JSON.parse(result.stdout)).not.toThrow();

      const json = JSON.parse(result.stdout);
      expect(json).toHaveProperty('change');
      expect(json).toHaveProperty('capability_id');
      expect(json).toHaveProperty('capability_version');
      expect(json).toHaveProperty('function');
      expect(json).toHaveProperty('checks');
      expect(json).toHaveProperty('overall');

      expect(json.change).toBe('json-output');
      expect(json.capability_id).toBe('test_capability');
      expect(json.capability_version).toBe('1.0.0');
      expect(Array.isArray(json.checks)).toBe(true);
      expect(['pass', 'fail', 'blocked']).toContain(json.overall);
    });

    it('includes detailed check results in JSON', async () => {
      const changeDir = await createTestChange('detailed-json');
      await createValidCapability(changeDir);

      const result = await runCLI(['sds', 'check-drift', '--change', 'detailed-json', '--json'], {
        cwd: tempDir,
      });

      const json = JSON.parse(result.stdout);
      expect(json.checks.length).toBeGreaterThan(0);

      // Should have schema_validity check
      const schemaCheck = json.checks.find((c: any) => c.name === 'schema_validity');
      expect(schemaCheck).toBeDefined();
      expect(schemaCheck.status).toBe('pass');

      // Should have guarantees_documented check
      const guaranteesCheck = json.checks.find((c: any) => c.name === 'guarantees_documented');
      expect(guaranteesCheck).toBeDefined();
      expect(guaranteesCheck.status).toBe('pass');
    });
  });

  describe('well-formed capability (no issues)', () => {
    it('exits 0 with overall pass or blocked for valid capability', async () => {
      const changeDir = await createTestChange('well-formed');
      await createValidCapability(changeDir);

      const result = await runCLI(['sds', 'check-drift', '--change', 'well-formed'], {
        cwd: tempDir,
      });

      // Should not exit with failure (exitCode 1) - may be 0 (pass) or blocked
      expect(result.exitCode).not.toBe(1);

      const output = getOutput(result);
      expect(output).toContain('test_capability');
      expect(output).toContain('✓'); // Should have some passing checks
      expect(output).toMatch(/Overall: (PASS|BLOCKED)/);
    });

    it('shows passing checks for well-formed capability', async () => {
      const changeDir = await createTestChange('all-checks-pass');
      await createValidCapability(changeDir);

      const result = await runCLI(['sds', 'check-drift', '--change', 'all-checks-pass'], {
        cwd: tempDir,
      });

      const output = getOutput(result);

      // These checks should pass for a well-formed capability
      expect(output).toContain('schema_validity');
      expect(output).toContain('guarantees_documented');
      expect(output).toContain('effects_classified');
      expect(output).toContain('composability_consistency');

      // Should not contain any hard failures
      expect(output).not.toMatch(/\[✗\].*guarantees_documented/);
      expect(output).not.toMatch(/\[✗\].*effects_classified/);
      expect(output).not.toMatch(/\[✗\].*composability_consistency/);
    });
  });

  describe('--update-hash functionality', () => {
    it('writes validation block when --update-hash is used with valid test_inputs', async () => {
      const changeDir = await createTestChange('update-hash-test');

      const capabilityWithTestInputs = [
        'id: update_hash_capability',
        'version: 1.0.0',
        'description: Capability for testing hash updates',
        'guarantees:',
        '  - "All operations are validated"',
        'baml_binding:',
        '  function: UpdateHashCapability',
        '  test_inputs:',
        '    - input_field: test_value_1',
        '    - input_field: test_value_2',
      ].join('\n');

      await fs.writeFile(path.join(changeDir, 'capability.yaml'), capabilityWithTestInputs);

      const result = await runCLI(
        ['sds', 'check-drift', '--change', 'update-hash-test', '--update-hash'],
        { cwd: tempDir }
      );

      const output = getOutput(result);
      expect(output).toContain('Updated validation.hash in capability.yaml');

      // Verify that validation block was added to the file
      const updatedContent = await fs.readFile(path.join(changeDir, 'capability.yaml'), 'utf-8');
      expect(updatedContent).toContain('validation:');
      expect(updatedContent).toContain('hash:');
      expect(updatedContent).toContain('verified_at:');
      expect(updatedContent).toContain('verified_version: 1.0.0');
    });

    it('detects hash mismatch and refuses update when inputs change', async () => {
      const changeDir = await createTestChange('hash-mismatch');

      // Create capability with test_inputs and incorrect hash
      const capabilityWithWrongHash = [
        'id: hash_mismatch_capability',
        'version: 1.0.0',
        'description: Capability with wrong hash',
        'guarantees:',
        '  - "All operations are validated"',
        'baml_binding:',
        '  function: HashMismatchCapability',
        '  test_inputs:',
        '    - input_field: current_value',
        'validation:',
        '  hash: "0000000000000000000000000000000000000000000000000000000000000000"', // Wrong hash
        '  verified_at: "2023-01-01T12:00:00Z"',
        '  verified_version: "1.0.0"',
      ].join('\n');

      await fs.writeFile(path.join(changeDir, 'capability.yaml'), capabilityWithWrongHash);

      const result = await runCLI(
        ['sds', 'check-drift', '--change', 'hash-mismatch', '--update-hash'],
        { cwd: tempDir }
      );

      const output = getOutput(result);
      expect(output).toContain('Hash mismatch — structural drift detected');
      expect(output).toContain('--update-hash refused');
      expect(output).toContain('resolve all FAIL checks');
      expect(result.exitCode).toBe(1);
    });

    it('refuses --update-hash when there are failing checks', async () => {
      const changeDir = await createTestChange('failing-update-hash');

      const capabilityWithFailures = [
        'id: failing_capability',
        'version: 1.0.0',
        'description: Capability with failures',
        'guarantees:',
        '  - "TODO: Add real guarantees"', // This will fail
        'baml_binding:',
        '  function: FailingCapability',
        '  test_inputs:',
        '    - input_field: test_value',
      ].join('\n');

      await fs.writeFile(path.join(changeDir, 'capability.yaml'), capabilityWithFailures);

      const result = await runCLI(
        ['sds', 'check-drift', '--change', 'failing-update-hash', '--update-hash'],
        { cwd: tempDir }
      );

      const output = getOutput(result);
      expect(output).toContain('--update-hash refused');
      expect(output).toContain('resolve all FAIL checks');
      expect(result.exitCode).toBe(1);
    });

    it('skips --update-hash when no test_inputs are defined', async () => {
      const changeDir = await createTestChange('no-test-inputs');

      const capabilityWithoutTestInputs = [
        'id: no_inputs_capability',
        'version: 1.0.0',
        'description: Capability without test inputs',
        'guarantees:',
        '  - "All operations are validated"',
        'baml_binding:',
        '  function: NoInputsCapability',
        '  # no test_inputs defined',
      ].join('\n');

      await fs.writeFile(path.join(changeDir, 'capability.yaml'), capabilityWithoutTestInputs);

      const result = await runCLI(
        ['sds', 'check-drift', '--change', 'no-test-inputs', '--update-hash'],
        { cwd: tempDir }
      );

      const output = getOutput(result);
      expect(output).toContain('--update-hash skipped: no test_inputs defined');
    });
  });

  describe('non-governed schema warnings', () => {
    it('shows warning when running check-drift on non-governed schema but continues', async () => {
      const changeDir = await createTestChange('non-governed', 'sds-lean');
      // Create minimal capability anyway to test the warning
      await createValidCapability(changeDir);

      const result = await runCLI(['sds', 'check-drift', '--change', 'non-governed'], {
        cwd: tempDir,
      });

      const output = getOutput(result);
      expect(output).toContain('check-drift is intended for governed-tier changes');
      expect(output).toContain('sds-lean');
      expect(output).toContain('Proceeding anyway');
    });
  });
});