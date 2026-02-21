/**
 * JSON5 Config Read/Write Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import JSON5 from 'json5';

import { readJson5Config, writeJson5Config, atomicWriteJson } from '../src/core/utils.js';

const TEST_DIR = join(tmpdir(), 'skillgate-json5-test');

describe('JSON5 Config Handling', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should read JSON5 with comments', async () => {
    const configPath = join(TEST_DIR, 'config-with-comments.json');
    const content = `{
      // This is a comment
      "name": "test",
      "enabled": true,
      /* Multi-line
         comment */
      "count": 42
    }`;

    await writeFile(configPath, content, 'utf-8');

    const config = await readJson5Config<{ name: string; enabled: boolean; count: number }>(
      configPath
    );

    expect(config).not.toBeNull();
    expect(config?.name).toBe('test');
    expect(config?.enabled).toBe(true);
    expect(config?.count).toBe(42);
  });

  it('should read JSON5 with trailing commas', async () => {
    const configPath = join(TEST_DIR, 'config-trailing-commas.json');
    const content = `{
      "items": [
        "one",
        "two",
        "three",
      ],
      "nested": {
        "value": 123,
      },
    }`;

    await writeFile(configPath, content, 'utf-8');

    const config = await readJson5Config<{ items: string[]; nested: { value: number } }>(
      configPath
    );

    expect(config).not.toBeNull();
    expect(config?.items).toEqual(['one', 'two', 'three']);
    expect(config?.nested.value).toBe(123);
  });

  it('should write valid JSON (subset of JSON5)', async () => {
    const configPath = join(TEST_DIR, 'output.json');
    const data = {
      skills: {
        entries: {
          'my-skill': {
            enabled: false,
            _quarantine: {
              timestamp: '2026-02-21T00:00:00Z',
              reason: 'Test',
            },
          },
        },
      },
    };

    await writeJson5Config(configPath, data);

    // Read back as raw text
    const rawContent = await readFile(configPath, 'utf-8');

    // Should be valid JSON
    const parsed = JSON.parse(rawContent);
    expect(parsed.skills.entries['my-skill'].enabled).toBe(false);

    // Also valid JSON5
    const parsed5 = JSON5.parse(rawContent);
    expect(parsed5.skills.entries['my-skill']._quarantine.reason).toBe('Test');
  });

  it('should preserve data through read-modify-write cycle with comments', async () => {
    const configPath = join(TEST_DIR, 'cycle-test.json');

    // Start with JSON5 content (comments)
    const initial = `{
      // User settings
      "userPrefs": {
        "theme": "dark"
      },
      // Skills config
      "skills": {
        "entries": {}
      }
    }`;

    await writeFile(configPath, initial, 'utf-8');

    // Read
    const config = await readJson5Config<any>(configPath);
    expect(config).not.toBeNull();

    // Modify
    config.skills.entries['new-skill'] = { enabled: true };

    // Write back (note: comments will be lost as we write JSON)
    await writeJson5Config(configPath, config);

    // Read again
    const config2 = await readJson5Config<any>(configPath);
    expect(config2?.skills.entries['new-skill'].enabled).toBe(true);
    expect(config2?.userPrefs.theme).toBe('dark');
  });

  it('should handle atomic writes correctly', async () => {
    const configPath = join(TEST_DIR, 'atomic.json');
    const data = { test: 'value', number: 42 };

    await atomicWriteJson(configPath, data);

    const content = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.test).toBe('value');
    expect(parsed.number).toBe(42);
  });

  it('should create parent directories on write', async () => {
    const deepPath = join(TEST_DIR, 'deep', 'nested', 'config.json');
    const data = { created: true };

    await writeJson5Config(deepPath, data);

    const config = await readJson5Config<{ created: boolean }>(deepPath);
    expect(config?.created).toBe(true);
  });

  it('should return null for non-existent files', async () => {
    const config = await readJson5Config<any>(join(TEST_DIR, 'does-not-exist.json'));
    expect(config).toBeNull();
  });

  it('should handle OpenClaw-style config', async () => {
    const configPath = join(TEST_DIR, 'openclaw.json');

    // Typical OpenClaw config with JSON5 features
    const content = `{
      // OpenClaw Configuration
      "version": "1.0",

      // Skill directories
      "skills": {
        "dirs": [
          "~/.local/share/skills",
          "/opt/company-skills",
        ],
        "entries": {
          "example-skill": {
            "enabled": true,
            "path": "/path/to/skill",
          }
        }
      }
    }`;

    await writeFile(configPath, content, 'utf-8');

    // Read with JSON5
    const config = await readJson5Config<any>(configPath);
    expect(config?.version).toBe('1.0');
    expect(config?.skills.dirs).toHaveLength(2);
    expect(config?.skills.entries['example-skill'].enabled).toBe(true);

    // Add a quarantine entry
    config.skills.entries['risky-skill'] = {
      enabled: false,
      _quarantine: {
        timestamp: new Date().toISOString(),
        reason: 'CRITICAL risk detected',
        evidenceId: 'ev-12345678',
      },
    };

    // Write back
    await writeJson5Config(configPath, config);

    // Verify OpenClaw can still read it (as JSON)
    const rawContent = await readFile(configPath, 'utf-8');
    const asJson = JSON.parse(rawContent);
    expect(asJson.skills.entries['risky-skill']._quarantine.evidenceId).toBe('ev-12345678');
  });
});
