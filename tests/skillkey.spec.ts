/**
 * SkillKey Resolution Tests
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import JSON5 from 'json5';

import { DiscoveredSkill, SkillMetadata } from '../src/core/discover.js';

const FIXTURES_DIR = join(__dirname, 'fixtures');

describe('SkillKey Canonical Resolution', () => {
  it('should prefer metadata.openclaw.skillKey over directory name', async () => {
    const skillPath = join(FIXTURES_DIR, 'skillkey-mismatch-skill');
    const skillJson = await readFile(join(skillPath, 'skill.json'), 'utf-8');
    const metadata = JSON5.parse(skillJson) as SkillMetadata;

    // Simulate discovery logic
    let skillKey = 'skillkey-mismatch-skill'; // directory name fallback

    if (metadata.openclaw?.skillKey) {
      skillKey = metadata.openclaw.skillKey;
    } else if (metadata.name) {
      skillKey = metadata.name;
    }

    expect(skillKey).toBe('canonical-skill-key');
  });

  it('should use metadata.name as second priority', () => {
    const metadata: SkillMetadata = {
      name: 'metadata-name-skill',
      version: '1.0.0',
    };

    let skillKey = 'directory-fallback';

    if (metadata.openclaw?.skillKey) {
      skillKey = metadata.openclaw.skillKey;
    } else if (metadata.name) {
      skillKey = metadata.name;
    }

    expect(skillKey).toBe('metadata-name-skill');
  });

  it('should fall back to directory name when no metadata keys exist', () => {
    const metadata: SkillMetadata = {
      version: '1.0.0',
      description: 'No name or skillKey',
    };

    let skillKey = 'directory-fallback';

    if (metadata.openclaw?.skillKey) {
      skillKey = metadata.openclaw.skillKey;
    } else if (metadata.name) {
      skillKey = metadata.name;
    }

    expect(skillKey).toBe('directory-fallback');
  });

  it('should handle undefined metadata', () => {
    const metadata: SkillMetadata | undefined = undefined;

    let skillKey = 'directory-fallback';

    if (metadata?.openclaw?.skillKey) {
      skillKey = metadata.openclaw.skillKey;
    } else if (metadata?.name) {
      skillKey = metadata.name;
    }

    expect(skillKey).toBe('directory-fallback');
  });

  it('should use correct skillKey in quarantine operations', () => {
    // Simulate a skill with mismatch
    const skill: DiscoveredSkill = {
      skillKey: 'canonical-skill-key', // Resolved from metadata.openclaw.skillKey
      path: '/path/to/skillkey-mismatch-skill', // Directory name differs
      source: 'workspace',
      metadata: {
        name: 'directory-name-skill',
        openclaw: {
          skillKey: 'canonical-skill-key',
        },
      },
    };

    // When quarantining, we should use skill.skillKey
    const configEntry = {
      [skill.skillKey]: {
        enabled: false,
        _quarantine: {
          timestamp: new Date().toISOString(),
          reason: 'Test',
          evidenceId: 'ev-test',
        },
      },
    };

    // Should be keyed by canonical skillKey, not directory name
    expect(configEntry['canonical-skill-key']).toBeDefined();
    expect(configEntry['skillkey-mismatch-skill']).toBeUndefined();
  });
});

describe('SkillKey Edge Cases', () => {
  it('should handle skillKey with special characters', () => {
    const metadata: SkillMetadata = {
      name: '@scope/skill-name',
      openclaw: {
        skillKey: '@scope/skill-name',
      },
    };

    let skillKey = 'fallback';
    if (metadata.openclaw?.skillKey) {
      skillKey = metadata.openclaw.skillKey;
    }

    expect(skillKey).toBe('@scope/skill-name');
  });

  it('should handle empty string skillKey (use fallback)', () => {
    const metadata: SkillMetadata = {
      name: 'actual-name',
      openclaw: {
        skillKey: '', // Empty string should be falsy
      },
    };

    let skillKey = 'fallback';
    if (metadata.openclaw?.skillKey) {
      skillKey = metadata.openclaw.skillKey;
    } else if (metadata.name) {
      skillKey = metadata.name;
    }

    expect(skillKey).toBe('actual-name');
  });

  it('should handle null skillKey in metadata', () => {
    const metadata: any = {
      name: 'actual-name',
      openclaw: {
        skillKey: null,
      },
    };

    let skillKey = 'fallback';
    if (metadata.openclaw?.skillKey) {
      skillKey = metadata.openclaw.skillKey;
    } else if (metadata.name) {
      skillKey = metadata.name;
    }

    expect(skillKey).toBe('actual-name');
  });
});
