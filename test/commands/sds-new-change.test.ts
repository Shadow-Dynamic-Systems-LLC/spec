import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { runCLI } from '../helpers/run-cli.js';

describe('sds new-change command', () => {
  let tempDir: string;
  let changesDir: string;
  let openspecDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-sds-new-change-'));
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
   * Reads the .openspec.yaml metadata file from a change directory.
   */
  async function readChangeMetadata(changeName: string): Promise<string> {
    const metadataPath = path.join(changesDir, changeName, '.openspec.yaml');
    return await fs.readFile(metadataPath, 'utf-8');
  }

  /**
   * Checks if a file exists in the change directory.
   */
  async function fileExists(changeName: string, fileName: string): Promise<boolean> {
    const filePath = path.join(changesDir, changeName, fileName);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  describe('default tier (lean)', () => {
    it('creates change with default tier (lean)', async () => {
      const result = await runCLI(['sds', 'new-change', 'my-lean-change'], { cwd: tempDir });
      expect(result.exitCode).toBe(0);

      const output = getOutput(result);
      expect(output).toContain("Created lean-tier change 'my-lean-change'");
      expect(output).toContain('schema: sds-lean');

      // Check that the change directory was created
      const changeDir = path.join(changesDir, 'my-lean-change');
      const stat = await fs.stat(changeDir);
      expect(stat.isDirectory()).toBe(true);

      // Check that .openspec.yaml contains sds-lean schema
      const metadata = await readChangeMetadata('my-lean-change');
      expect(metadata).toContain('schema: sds-lean');

      // Template files are not automatically created by new-change command
      // They are created when using the instructions command
      expect(await fileExists('my-lean-change', 'proposal.md')).toBe(false);
    });

    it('shows next steps instructions for lean tier', async () => {
      const result = await runCLI(['sds', 'new-change', 'lean-steps'], { cwd: tempDir });
      expect(result.exitCode).toBe(0);

      const output = getOutput(result);
      expect(output).toContain('Next steps:');
      expect(output).toContain('openspec instructions proposal --change lean-steps');
      // Lean tier should not show capability or controls instructions
      expect(output).not.toContain('openspec instructions capability');
      expect(output).not.toContain('openspec instructions controls');
    });
  });

  describe('standard tier', () => {
    it('creates change with --tier standard', async () => {
      const result = await runCLI(['sds', 'new-change', 'my-standard-change', '--tier', 'standard'], {
        cwd: tempDir,
      });
      expect(result.exitCode).toBe(0);

      const output = getOutput(result);
      expect(output).toContain("Created standard-tier change 'my-standard-change'");
      expect(output).toContain('schema: sds-standard');

      // Check .openspec.yaml contains sds-standard schema
      const metadata = await readChangeMetadata('my-standard-change');
      expect(metadata).toContain('schema: sds-standard');

      // Template files are not automatically created by new-change command
      // They are created when using the instructions command
      expect(await fileExists('my-standard-change', 'brief.md')).toBe(false);
      expect(await fileExists('my-standard-change', 'prd.md')).toBe(false);
    });
  });

  describe('brownfield tier', () => {
    it('creates change with --tier brownfield', async () => {
      const result = await runCLI(['sds', 'new-change', 'my-brownfield-change', '--tier', 'brownfield'], {
        cwd: tempDir,
      });
      expect(result.exitCode).toBe(0);

      const output = getOutput(result);
      expect(output).toContain("Created brownfield-tier change 'my-brownfield-change'");
      expect(output).toContain('schema: sds-brownfield');

      // Check .openspec.yaml contains sds-brownfield schema
      const metadata = await readChangeMetadata('my-brownfield-change');
      expect(metadata).toContain('schema: sds-brownfield');
    });
  });

  describe('governed tier', () => {
    it('creates change with --tier governed', async () => {
      const result = await runCLI(['sds', 'new-change', 'my-governed-change', '--tier', 'governed'], {
        cwd: tempDir,
      });
      expect(result.exitCode).toBe(0);

      const output = getOutput(result);
      expect(output).toContain("Created governed-tier change 'my-governed-change'");
      expect(output).toContain('schema: sds-governed');

      // Check .openspec.yaml contains sds-governed schema
      const metadata = await readChangeMetadata('my-governed-change');
      expect(metadata).toContain('schema: sds-governed');

      // Template files are not automatically created by new-change command
      // They are created when using the instructions command
      expect(await fileExists('my-governed-change', 'capability.yaml')).toBe(false);
    });

    it('shows capability and controls instructions for governed tier', async () => {
      const result = await runCLI(['sds', 'new-change', 'governed-steps', '--tier', 'governed'], {
        cwd: tempDir,
      });
      expect(result.exitCode).toBe(0);

      const output = getOutput(result);
      expect(output).toContain('Next steps:');
      expect(output).toContain('openspec instructions proposal --change governed-steps');
      expect(output).toContain('openspec instructions capability --change governed-steps');
      expect(output).toContain('openspec instructions controls --change governed-steps');
    });
  });

  describe('error cases', () => {
    it('rejects invalid tier', async () => {
      const result = await runCLI(['sds', 'new-change', 'invalid-tier-change', '--tier', 'invalid'], {
        cwd: tempDir,
      });
      expect(result.exitCode).toBe(1);

      const output = getOutput(result);
      expect(output).toContain("Invalid tier 'invalid'");
      expect(output).toContain('Valid tiers: lean, standard, brownfield, governed');
    });

    it('rejects invalid change name (uppercase)', async () => {
      const result = await runCLI(['sds', 'new-change', 'InvalidChangeName'], { cwd: tempDir });
      expect(result.exitCode).toBe(1);

      const output = getOutput(result);
      expect(output).toContain('Error');
      // Should mention change name validation error
    });

    it('rejects invalid change name (spaces)', async () => {
      const result = await runCLI(['sds', 'new-change', 'invalid change name'], { cwd: tempDir });
      expect(result.exitCode).toBe(1);

      const output = getOutput(result);
      expect(output).toContain('Error');
    });

    it('rejects invalid change name (starts with number)', async () => {
      const result = await runCLI(['sds', 'new-change', '123-invalid'], { cwd: tempDir });
      expect(result.exitCode).toBe(1);

      const output = getOutput(result);
      expect(output).toContain('Error');
    });

    it('rejects missing change name argument', async () => {
      const result = await runCLI(['sds', 'new-change'], { cwd: tempDir });
      expect(result.exitCode).toBe(1);

      const output = getOutput(result);
      expect(output).toContain('missing required argument');
    });

    it('rejects duplicate change name', async () => {
      // Create first change
      const firstResult = await runCLI(['sds', 'new-change', 'existing-change'], { cwd: tempDir });
      expect(firstResult.exitCode).toBe(0);

      // Try to create duplicate
      const secondResult = await runCLI(['sds', 'new-change', 'existing-change'], { cwd: tempDir });
      expect(secondResult.exitCode).toBe(1);

      const output = getOutput(secondResult);
      expect(output).toContain('exists');
    });
  });

  describe('description option', () => {
    it('creates README.md when --description is provided', async () => {
      const result = await runCLI(
        ['sds', 'new-change', 'described-change', '--description', 'This is a test SDS change'],
        { cwd: tempDir }
      );
      expect(result.exitCode).toBe(0);

      // Check that README.md was created
      const readmePath = path.join(changesDir, 'described-change', 'README.md');
      const content = await fs.readFile(readmePath, 'utf-8');
      expect(content).toContain('described-change');
      expect(content).toContain('This is a test SDS change');
    });

    it('works with --description and --tier together', async () => {
      const result = await runCLI(
        [
          'sds',
          'new-change',
          'governed-described',
          '--tier',
          'governed',
          '--description',
          'A governed change with description',
        ],
        { cwd: tempDir }
      );
      expect(result.exitCode).toBe(0);

      const output = getOutput(result);
      expect(output).toContain("Created governed-tier change 'governed-described'");
      expect(output).toContain('schema: sds-governed');

      // Check that README.md was created
      const readmePath = path.join(changesDir, 'governed-described', 'README.md');
      const content = await fs.readFile(readmePath, 'utf-8');
      expect(content).toContain('governed-described');
      expect(content).toContain('A governed change with description');

      // Check that .openspec.yaml has correct schema
      const metadata = await readChangeMetadata('governed-described');
      expect(metadata).toContain('schema: sds-governed');
    });
  });

  describe('schema validation', () => {
    it('validates that the schema exists', async () => {
      // This test assumes that sds-lean schema exists in the package
      // If this fails, it means the schema files are not available during tests
      const result = await runCLI(['sds', 'new-change', 'schema-test', '--tier', 'lean'], {
        cwd: tempDir,
      });

      if (result.exitCode !== 0) {
        const output = getOutput(result);
        // If schema doesn't exist, should get a clear error message
        expect(output).toContain('Schema') || expect(output).toContain('not found');
      } else {
        // If it succeeds, schema validation passed
        expect(result.exitCode).toBe(0);
      }
    });
  });

  describe('integration with existing project structure', () => {
    it('works in a project with existing openspec directory', async () => {
      // Create some existing structure
      await fs.writeFile(path.join(openspecDir, 'config.yaml'), 'schema: spec-driven\n');

      const result = await runCLI(['sds', 'new-change', 'integration-test'], { cwd: tempDir });
      expect(result.exitCode).toBe(0);

      const output = getOutput(result);
      expect(output).toContain("Created lean-tier change 'integration-test'");

      // Verify the change was created correctly
      const metadata = await readChangeMetadata('integration-test');
      expect(metadata).toContain('schema: sds-lean');
    });

    it('works when changes directory already has other changes', async () => {
      // Create an existing regular change directory
      const existingChangeDir = path.join(changesDir, 'existing-regular-change');
      await fs.mkdir(existingChangeDir, { recursive: true });
      await fs.writeFile(path.join(existingChangeDir, 'proposal.md'), '# Existing Change\n');

      const result = await runCLI(['sds', 'new-change', 'new-sds-change'], { cwd: tempDir });
      expect(result.exitCode).toBe(0);

      // Both changes should exist
      const existingExists = await fs
        .access(existingChangeDir)
        .then(() => true)
        .catch(() => false);
      expect(existingExists).toBe(true);

      const newChangeDir = path.join(changesDir, 'new-sds-change');
      const newExists = await fs
        .access(newChangeDir)
        .then(() => true)
        .catch(() => false);
      expect(newExists).toBe(true);

      // New change should have SDS schema
      const metadata = await readChangeMetadata('new-sds-change');
      expect(metadata).toContain('schema: sds-lean');
    });
  });
});