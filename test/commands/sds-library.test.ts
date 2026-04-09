import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { runCLI } from '../helpers/run-cli.js';

// NOTE: These tests are skipped until the SDS commands are implemented
// Tests cover: governance-review, compose-from-library, extract-library-parts
// To enable: Change describe.skip to describe when SDS commands are added to CLI
describe('SDS library commands', () => {
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
- id: audit_log
  name: "Audit Log Capability"
  type: capability
  description: "Provides audit logging functionality"
  domain_tags: ["security", "compliance"]
  version: "1.0.0"
  status: active

- id: human_in_the_loop
  name: "Human in the Loop Pattern"
  type: pattern
  description: "Ensures human oversight in automated processes"
  domain_tags: ["governance", "oversight"]
  version: "1.0.0"
  status: active
`;
    await fs.writeFile(
      path.join(tempDir, 'openspec', 'library', 'capability', 'registry.yaml'),
      registryContent,
      'utf-8'
    );
  }

  describe('openspec sds governance-review', () => {
    it('with --role analyst outputs XML with governance_review role and owned_artifacts', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'governance-review', '--role', 'analyst', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = getOutput(result);
      expect(output).toContain('<governance_review role="Analyst"');
      expect(output).toContain('<owned_artifacts>');
    });

    it('with --role governor at governed tier prints isolation_required block', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'governance-review', '--role', 'governor', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = getOutput(result);
      expect(output).toContain('<isolation_required>');
    });

    it('with --role verifier at governed tier prints isolation_required block', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'governance-review', '--role', 'verifier', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = getOutput(result);
      expect(output).toContain('<isolation_required>');
    });

    it('with --role pm at governed tier does NOT print isolation_required', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'governance-review', '--role', 'pm', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = getOutput(result);
      expect(output).not.toContain('<isolation_required>');
    });

    it('missing --role flag exits non-zero with Commander error about required option', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'governance-review', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).not.toBe(0);
      const output = getOutput(result);
      expect(output).toContain('required option');
    });

    it('invalid --role bogus exits non-zero with error mentioning valid roles', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'governance-review', '--role', 'bogus', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).not.toBe(0);
      const output = getOutput(result);
      expect(output).toContain('Valid roles');
    });

    it('--json flag outputs valid JSON with role, roleKey, tier fields', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'governance-review', '--role', 'analyst', '--json', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = result.stdout.trim();
      expect(() => JSON.parse(output)).not.toThrow();

      const json = JSON.parse(output);
      expect(json).toHaveProperty('role');
      expect(json).toHaveProperty('roleKey');
      expect(json).toHaveProperty('tier');
    });

    it('missing dependency artifacts are reported in warning block', async () => {
      const changeDir = await createTestChange('test-change');

      // pm role depends on brief.md and brownfield-notes.md, neither of which exist
      const result = await runCLI(['sds', 'governance-review', '--role', 'pm', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = getOutput(result);
      expect(output).toContain('<warning>');
    });
  });

  describe('openspec sds compose-from-library', () => {
    beforeEach(async () => {
      await createRegistryFile();
    });

    it('cap:audit_log resolves from registry and writes composed-audit-log.md to change dir', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'compose-from-library', 'cap:audit_log', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const composedFile = path.join(changeDir, 'composed-audit-log.md');
      expect(fs.access(composedFile)).resolves.toBeUndefined();
    });

    it('cap:audit_log with --dry-run does NOT write file, prints preview to stdout', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'compose-from-library', 'cap:audit_log', '--dry-run', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('audit');

      const composedFile = path.join(changeDir, 'composed-audit-log.md');
      await expect(fs.access(composedFile)).rejects.toThrow();
    });

    it('pattern:human-in-the-loop resolves and writes composed-pattern-human-in-the-loop.md', async () => {
      const changeDir = await createTestChange('test-change');
      // Create the pattern file so it can be resolved
      await fs.mkdir(path.join(tempDir, 'openspec', 'library', 'patterns', 'human_in_the_loop'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'openspec', 'library', 'patterns', 'human_in_the_loop', 'pattern.md'),
        '# Human in the Loop Pattern\n\nEnsures human oversight in automated processes.\n',
        'utf-8'
      );

      const result = await runCLI(['sds', 'compose-from-library', 'pattern:human_in_the_loop', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      // outputFileName uses the slug as-is: human_in_the_loop → composed-pattern-human_in_the_loop.md
      const composedFile = path.join(changeDir, 'composed-pattern-human_in_the_loop.md');
      expect(fs.access(composedFile)).resolves.toBeUndefined();
    });

    it('missing part-id argument exits non-zero with error mentioning missing required argument', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'compose-from-library'], { cwd: tempDir });

      expect(result.exitCode).not.toBe(0);
      const output = getOutput(result);
      expect(output).toContain('missing required argument');
    });

    it('invalid prefix foo:bar exits non-zero with error mentioning must start with one of', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'compose-from-library', 'foo:bar', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).not.toBe(0);
      const output = getOutput(result);
      expect(output).toContain('must start with one of');
    });

    it('unknown cap ID cap:nonexistent_thing exits non-zero with "No library part found" error', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'compose-from-library', 'cap:nonexistent_thing', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).not.toBe(0);
      const output = getOutput(result);
      expect(output).toContain('No library part found');
    });

    it('after composing, traceability.md is created/updated in change dir with provenance section', async () => {
      const changeDir = await createTestChange('test-change');

      const result = await runCLI(['sds', 'compose-from-library', 'cap:audit_log', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const traceabilityFile = path.join(changeDir, 'traceability.md');
      expect(fs.access(traceabilityFile)).resolves.toBeUndefined();

      const content = await fs.readFile(traceabilityFile, 'utf-8');
      expect(content).toContain('Library Composition');
    });
  });

  describe('openspec sds extract-library-parts', () => {
    it('change with no tagged blocks exits 0, output says "0" candidates', async () => {
      const changeDir = await createTestChange('test-change');
      await fs.writeFile(path.join(changeDir, 'artifact.md'), '# Simple Content\n\nNo tagged blocks.', 'utf-8');

      const result = await runCLI(['sds', 'extract-library-parts', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = getOutput(result);
      expect(output).toContain('0');
      expect(output).toContain('candidates');
    });

    it('change with requirement id but no library_source is reported as candidate', async () => {
      // Use spec-driven schema so governed-tier blocking does not cause exit 1
      const changeDir = await createTestChange('test-change', 'spec-driven');
      await fs.writeFile(
        path.join(changeDir, 'artifact.md'),
        '# Requirements\n\n<requirement id="REQ-001">Test requirement</requirement>\n',
        'utf-8'
      );

      const result = await runCLI(['sds', 'extract-library-parts', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = getOutput(result);
      expect(output).toContain('REQ-001');
      expect(output).toContain('candidate');
    });

    it('change with requirement having library_source is NOT a candidate', async () => {
      const changeDir = await createTestChange('test-change');
      await fs.writeFile(
        path.join(changeDir, 'artifact.md'),
        '# Requirements\n\n<requirement id="REQ-001" library_source="requirement-snippets:something">Test requirement</requirement>\n',
        'utf-8'
      );

      const result = await runCLI(['sds', 'extract-library-parts', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = getOutput(result);
      expect(output).not.toContain('REQ-001');
    });

    it('--defer-all with candidates at governed tier writes to extraction-backlog.yaml', async () => {
      const changeDir = await createTestChange('test-change');
      await fs.writeFile(
        path.join(changeDir, 'artifact.md'),
        '# Requirements\n\n<requirement id="REQ-001">Test requirement</requirement>\n',
        'utf-8'
      );

      const result = await runCLI(['sds', 'extract-library-parts', '--defer-all', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const backlogFile = path.join(tempDir, 'openspec', 'library', 'extraction-backlog.yaml');
      expect(fs.access(backlogFile)).resolves.toBeUndefined();
    });

    it('--json flag outputs valid JSON with candidates array', async () => {
      // Use spec-driven schema so governed-tier blocking does not cause exit 1
      const changeDir = await createTestChange('test-change', 'spec-driven');
      await fs.writeFile(
        path.join(changeDir, 'artifact.md'),
        '# Requirements\n\n<requirement id="REQ-001">Test requirement</requirement>\n',
        'utf-8'
      );

      const result = await runCLI(['sds', 'extract-library-parts', '--json', '--change', 'test-change'], { cwd: tempDir });

      expect(result.exitCode).toBe(0);
      const output = result.stdout.trim();
      expect(() => JSON.parse(output)).not.toThrow();

      const json = JSON.parse(output);
      expect(json).toHaveProperty('candidates');
      expect(Array.isArray(json.candidates)).toBe(true);
    });
  });
});
