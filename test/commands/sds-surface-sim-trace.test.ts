import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { runCLI } from '../helpers/run-cli.js';

// NOTE: These tests are skipped until the SDS commands are implemented
// Tests cover: compute-surface, simulate-capability, traceability-check
// To enable: Change describe.skip to describe when SDS commands are added to CLI
describe('SDS surface/simulation/traceability commands', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sds-test-'));
    await fs.mkdir(path.join(tempDir, 'openspec', 'changes'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'openspec', 'library', 'capability'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function getOutput(result: { stdout: string; stderr: string }): string {
    return result.stdout + result.stderr;
  }

  async function createTestChange(name: string, schema = 'sds-governed'): Promise<string> {
    const changeDir = path.join(tempDir, 'openspec', 'changes', name);
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(
      path.join(changeDir, '.openspec.yaml'),
      `schema: ${schema}\n`,
      'utf-8'
    );
    await fs.writeFile(path.join(changeDir, 'proposal.md'), '# Proposal\n\nTest.\n');
    return changeDir;
  }

  async function createRegistryFile() {
    const registryContent = `
- id: test_capability
  name: "Test Capability"
  type: capability
  description: "A test capability for integration tests"
  domain_tags: ["testing"]
  version: "1.0.0"
  status: active

- id: audit_log
  name: "Audit Log Capability"
  type: capability
  description: "Provides audit logging functionality"
  domain_tags: ["security", "compliance"]
  version: "1.0.0"
  status: active
`;
    await fs.writeFile(
      path.join(tempDir, 'openspec', 'library', 'capability', 'registry.yaml'),
      registryContent,
      'utf-8'
    );
  }

  async function createCapabilityYaml(changeDir: string, external = false, hasApprovalGate = true, producesEvidence = true) {
    const capabilityContent = `
id: test_capability
kind: capability
version: 1.0.0
description: A test capability for unit testing.
inputs:
  - name: input_value
    type: string
    required: true
outputs:
  - name: result
    type: string
    required: true
preconditions:
  - caller is authorized
effects:
  reversible: false
  external: ${external}
  idempotent: false
  produces_evidence: ${producesEvidence}
composability:
  compatible_with:
    - audit_log
  conflicts_with: []
  requires_before:${hasApprovalGate ? '\n    - human_approval_gate' : ''}
    - audit_log
  requires_after: []
guarantees:
  - Output is always a non-empty string when input is valid
baml_binding:
  function: TestCapability
  auto_generate: true
  test_inputs:
    - input_value: "test input"
tags:
  - testing
`;
    await fs.writeFile(path.join(changeDir, 'capability.yaml'), capabilityContent, 'utf-8');
  }

  describe('openspec sds compute-surface', () => {
    beforeEach(async () => {
      await createRegistryFile();
    });

    it('with capability.yaml and registry.yaml accessible writes capability_surface.md', async () => {
      const changeDir = await createTestChange('test-change');
      await createCapabilityYaml(changeDir);

      const result = await runCLI(['sds', 'compute-surface', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const surfaceFile = path.join(changeDir, 'capability_surface.md');
      expect(fs.access(surfaceFile)).resolves.toBeUndefined();
    });

    it('capability_surface.md contains all four section headers', async () => {
      const changeDir = await createTestChange('test-change');
      await createCapabilityYaml(changeDir);

      const result = await runCLI(['sds', 'compute-surface', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const surfaceFile = path.join(changeDir, 'capability_surface.md');
      const content = await fs.readFile(surfaceFile, 'utf-8');

      expect(content).toContain('Newly Enabled');
      expect(content).toContain('Expanded Execution Domains');
      expect(content).toContain('Conditional');
      expect(content).toContain('Dead Zones');
    });

    it('external capability without human_approval_gate appears in Conditional section', async () => {
      const changeDir = await createTestChange('test-change');
      await createCapabilityYaml(changeDir, true, false); // external=true, hasApprovalGate=false

      const result = await runCLI(['sds', 'compute-surface', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const surfaceFile = path.join(changeDir, 'capability_surface.md');
      const content = await fs.readFile(surfaceFile, 'utf-8');
      expect(content).toContain('Conditional');
    });

    it('--json flag outputs valid JSON with newly_enabled, expanded_domains, conditional, dead_zones arrays', async () => {
      const changeDir = await createTestChange('test-change');
      await createCapabilityYaml(changeDir);

      const result = await runCLI(['sds', 'compute-surface', '--json', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = result.stdout.trim();
      expect(() => JSON.parse(output)).not.toThrow();

      const json = JSON.parse(output);
      expect(json).toHaveProperty('newly_enabled');
      expect(json).toHaveProperty('expanded_domains');
      expect(json).toHaveProperty('conditional');
      expect(json).toHaveProperty('dead_zones');
      expect(Array.isArray(json.newly_enabled)).toBe(true);
      expect(Array.isArray(json.expanded_domains)).toBe(true);
      expect(Array.isArray(json.conditional)).toBe(true);
      expect(Array.isArray(json.dead_zones)).toBe(true);
    });

    it('missing registry exits non-zero with error mentioning registry', async () => {
      const changeDir = await createTestChange('test-change');
      await createCapabilityYaml(changeDir);
      // Delete the registry file
      await fs.rm(path.join(tempDir, 'openspec', 'library', 'capability', 'registry.yaml'));

      const result = await runCLI(['sds', 'compute-surface', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).not.toBe(0);
      const output = getOutput(result);
      expect(output).toContain('registry');
    });
  });

  describe('openspec sds simulate-capability', () => {
    it('with valid capability.yaml writes simulation.md and exits 0', async () => {
      const changeDir = await createTestChange('test-change');
      await createCapabilityYaml(changeDir);

      const result = await runCLI(['sds', 'simulate-capability', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const simulationFile = path.join(changeDir, 'simulation.md');
      expect(fs.access(simulationFile)).resolves.toBeUndefined();
    });

    it('simulation.md contains all six section headers', async () => {
      const changeDir = await createTestChange('test-change');
      await createCapabilityYaml(changeDir);

      const result = await runCLI(['sds', 'simulate-capability', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const simulationFile = path.join(changeDir, 'simulation.md');
      const content = await fs.readFile(simulationFile, 'utf-8');

      expect(content).toContain('Coverage');
      expect(content).toContain('Constraint Activation');
      expect(content).toContain('Capability Utilization');
      expect(content).toContain('Latency Impact');
      expect(content).toContain('Unsafe Escape Paths');
      expect(content).toContain('Recommendations');
    });

    it('external capability without human_approval_gate has CRITICAL finding and exits non-zero', async () => {
      const changeDir = await createTestChange('test-change');
      await createCapabilityYaml(changeDir, true, false); // external=true, hasApprovalGate=false

      const result = await runCLI(['sds', 'simulate-capability', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).not.toBe(0);
      const output = getOutput(result);
      expect(output).toContain('CRITICAL');
    });

    it('external capability without produces_evidence=true has CRITICAL finding and exits non-zero', async () => {
      const changeDir = await createTestChange('test-change');
      await createCapabilityYaml(changeDir, true, true, false); // external=true, hasApprovalGate=true, producesEvidence=false

      const result = await runCLI(['sds', 'simulate-capability', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).not.toBe(0);
      const output = getOutput(result);
      expect(output).toContain('CRITICAL');
    });

    it('--json flag outputs valid JSON with open_criticals field', async () => {
      const changeDir = await createTestChange('test-change');
      await createCapabilityYaml(changeDir);

      const result = await runCLI(['sds', 'simulate-capability', '--json', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = result.stdout.trim();
      expect(() => JSON.parse(output)).not.toThrow();

      const json = JSON.parse(output);
      expect(json).toHaveProperty('open_criticals');
    });

    it('missing capability.yaml exits non-zero with error mentioning capability.yaml', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'simulate-capability', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).not.toBe(0);
      const output = getOutput(result);
      expect(output).toContain('capability.yaml');
    });
  });

  describe('openspec sds traceability-check', () => {
    it('with no tagged blocks in any artifact writes traceability.md with empty tables and exits 0', async () => {
      const changeDir = await createTestChange('test-change');
      await fs.writeFile(path.join(changeDir, 'artifact.md'), '# Simple Content\n\nNo tagged blocks.', 'utf-8');

      const result = await runCLI(['sds', 'traceability-check', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const traceabilityFile = path.join(changeDir, 'traceability.md');
      expect(fs.access(traceabilityFile)).resolves.toBeUndefined();

      const content = await fs.readFile(traceabilityFile, 'utf-8');
      expect(content).toContain('traceability');
    });

    it('with requirement id in prd.md, REQ-001 appears in Requirements table', async () => {
      // Use spec-driven schema so issues are warnings, not blocking errors
      const changeDir = await createTestChange('test-change', 'spec-driven');
      await fs.writeFile(
        path.join(changeDir, 'prd.md'),
        '# PRD\n\n<requirement id="REQ-001">Test requirement</requirement>\n',
        'utf-8'
      );

      const result = await runCLI(['sds', 'traceability-check', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const traceabilityFile = path.join(changeDir, 'traceability.md');
      const content = await fs.readFile(traceabilityFile, 'utf-8');
      expect(content).toContain('REQ-001');
      expect(content).toContain('Requirements');
    });

    it('with evidence linking to control creates link in traceability.md', async () => {
      // Use spec-driven schema so validation issues are warnings not blocking errors
      const changeDir = await createTestChange('test-change', 'spec-driven');
      // Create both an evidence block and a control block so the link can be resolved
      await fs.writeFile(
        path.join(changeDir, 'evidence.md'),
        '# Evidence\n\n<evidence id="EVD-001" control="CTL-001">Test evidence</evidence>\n\n<control id="CTL-001">A control</control>\n',
        'utf-8'
      );

      const result = await runCLI(['sds', 'traceability-check', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const traceabilityFile = path.join(changeDir, 'traceability.md');
      const content = await fs.readFile(traceabilityFile, 'utf-8');
      expect(content).toContain('EVD-001');
      expect(content).toContain('CTL-001');
    });

    it('--validate flag with no issues prints PASSED and does NOT write traceability.md', async () => {
      const changeDir = await createTestChange('test-change');
      await fs.writeFile(path.join(changeDir, 'artifact.md'), '# Simple Content\n\nNo tagged blocks.', 'utf-8');

      // Confirm traceability.md does not exist before running
      const traceabilityFile = path.join(changeDir, 'traceability.md');
      await expect(fs.access(traceabilityFile)).rejects.toThrow();

      const result = await runCLI(['sds', 'traceability-check', '--validate', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = getOutput(result);
      expect(output).toContain('PASSED');

      // File should still not exist after --validate
      await expect(fs.access(traceabilityFile)).rejects.toThrow();
    });

    it('--validate flag with missing linked requirement reports warning but exits 0 at non-governed tier', async () => {
      const changeDir = await createTestChange('test-change', 'spec-driven'); // non-governed tier
      await fs.writeFile(
        path.join(changeDir, 'evidence.md'),
        '# Evidence\n\n<evidence id="EVD-001" control="MISSING-CTL">Test evidence</evidence>\n',
        'utf-8'
      );

      const result = await runCLI(['sds', 'traceability-check', '--validate', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = getOutput(result);
      expect(output).toContain('Warnings');
    });

    it('--json flag outputs valid JSON with blocks and links arrays', async () => {
      // Use spec-driven (non-governed) schema so issues are warnings, not errors
      const changeDir = await createTestChange('test-change', 'spec-driven');
      await fs.writeFile(
        path.join(changeDir, 'prd.md'),
        '# PRD\n\n<requirement id="REQ-001">Test requirement</requirement>\n',
        'utf-8'
      );

      const result = await runCLI(['sds', 'traceability-check', '--json', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = result.stdout.trim();
      expect(() => JSON.parse(output)).not.toThrow();

      const json = JSON.parse(output);
      expect(json).toHaveProperty('blocks');
      expect(json).toHaveProperty('links');
      expect(Array.isArray(json.blocks)).toBe(true);
      expect(Array.isArray(json.links)).toBe(true);
    });

    it('existing traceability_overrides section is preserved on regeneration', async () => {
      // Use spec-driven (non-governed) schema so issues are warnings, not errors that block
      const changeDir = await createTestChange('test-change', 'spec-driven');
      await fs.writeFile(
        path.join(changeDir, 'traceability.md'),
        '# Traceability\n\n## traceability_overrides\n\nCustom overrides content\n',
        'utf-8'
      );
      await fs.writeFile(
        path.join(changeDir, 'prd.md'),
        '# PRD\n\n<requirement id="REQ-001">Test requirement</requirement>\n',
        'utf-8'
      );

      const result = await runCLI(['sds', 'traceability-check', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const traceabilityFile = path.join(changeDir, 'traceability.md');
      const content = await fs.readFile(traceabilityFile, 'utf-8');
      expect(content).toContain('traceability_overrides');
      expect(content).toContain('Custom overrides content');
    });
  });
});
