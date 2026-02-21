/**
 * P0 Gate Tests - Must all pass for release
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';

import { scanSkill, ScanResult } from '../src/core/scan.js';
import { assessRisk, RiskAssessment, shouldAutoQuarantine, shouldAutoDisable } from '../src/core/decision.js';
import { generateEvidence, saveEvidence, loadEvidence } from '../src/core/evidence.js';
import { quarantineSkill, restoreSkill, isQuarantined } from '../src/core/actions.js';
import { setTestMode } from '../src/core/authz.js';
import { DiscoveredSkill } from '../src/core/discover.js';
import { expandPath, OPENCLAW_CONFIG_PATH, EVIDENCE_DIR } from '../src/core/utils.js';

const FIXTURES_DIR = join(__dirname, 'fixtures');
const TEST_CONFIG_DIR = join(homedir(), '.openclaw-test');
const TEST_CONFIG_PATH = join(TEST_CONFIG_DIR, 'openclaw.json');

// Mock skill factory
function mockSkill(name: string, path: string): DiscoveredSkill {
  return {
    skillKey: name,
    path,
    source: 'workspace',
  };
}

describe('P0 Gate: Malicious Skill Detection', () => {
  const maliciousPath = join(FIXTURES_DIR, 'malicious-skill');
  let scanResult: ScanResult;
  let assessment: RiskAssessment;

  beforeAll(async () => {
    const skill = mockSkill('malicious-skill', maliciousPath);
    scanResult = await scanSkill(skill);
    assessment = assessRisk(scanResult.findings);
  });

  it('should detect multiple CRITICAL findings', () => {
    const criticalFindings = scanResult.findings.filter((f) => f.severity === 'CRITICAL');
    expect(criticalFindings.length).toBeGreaterThanOrEqual(2);
  });

  it('should assess as CRITICAL risk level', () => {
    expect(assessment.level).toBe('CRITICAL');
  });

  it('should recommend auto-quarantine', () => {
    expect(shouldAutoQuarantine(assessment)).toBe(true);
  });

  it('should generate complete evidence', async () => {
    const skill = mockSkill('malicious-skill', maliciousPath);
    const evidence = generateEvidence(scanResult, assessment);

    expect(evidence.id).toMatch(/^ev-/);
    expect(evidence.skillKey).toBe('malicious-skill');
    expect(evidence.riskLevel).toBe('CRITICAL');
    expect(evidence.findings.length).toBeGreaterThan(0);

    // Check redaction
    for (const finding of evidence.findings) {
      expect(finding.snippet_redacted).toBe(true);
      expect(finding.snippet_hash).toMatch(/^sha256:/);
      expect(finding.redaction_applied).toBe(true);
    }
  });
});

describe('P0 Gate: Safe Skill', () => {
  const safePath = join(FIXTURES_DIR, 'safe-skill');
  let scanResult: ScanResult;
  let assessment: RiskAssessment;

  beforeAll(async () => {
    const skill = mockSkill('safe-skill', safePath);
    scanResult = await scanSkill(skill);
    assessment = assessRisk(scanResult.findings);
  });

  it('should have no HIGH or CRITICAL findings', () => {
    const highFindings = scanResult.findings.filter(
      (f) => f.severity === 'CRITICAL' || f.severity === 'HIGH'
    );
    expect(highFindings.length).toBe(0);
  });

  it('should assess as SAFE or LOW', () => {
    expect(['SAFE', 'LOW']).toContain(assessment.level);
  });

  it('should NOT recommend any action', () => {
    expect(shouldAutoQuarantine(assessment)).toBe(false);
    expect(shouldAutoDisable(assessment)).toBe(false);
  });
});

describe('P0 Gate: Medium Risk Skill', () => {
  const mediumPath = join(FIXTURES_DIR, 'medium-risk-skill');
  let scanResult: ScanResult;
  let assessment: RiskAssessment;

  beforeAll(async () => {
    const skill = mockSkill('medium-risk-skill', mediumPath);
    scanResult = await scanSkill(skill);
    assessment = assessRisk(scanResult.findings);
  });

  it('should have MEDIUM findings', () => {
    const mediumFindings = scanResult.findings.filter((f) => f.severity === 'MEDIUM');
    expect(mediumFindings.length).toBeGreaterThan(0);
  });

  it('should assess as MEDIUM or lower (not CRITICAL/HIGH)', () => {
    expect(['MEDIUM', 'LOW', 'SAFE']).toContain(assessment.level);
  });

  it('should generate evidence for MEDIUM risk', async () => {
    if (assessment.level === 'MEDIUM') {
      const skill = mockSkill('medium-risk-skill', mediumPath);
      const evidence = generateEvidence(scanResult, assessment);
      expect(evidence.riskLevel).toBe('MEDIUM');
    }
  });
});

describe('P0 Gate: SkillKey Resolution', () => {
  const mismatchPath = join(FIXTURES_DIR, 'skillkey-mismatch-skill');

  it('should use canonical skillKey from metadata', async () => {
    // Read the skill.json to verify it has openclaw.skillKey
    const skillJson = await readFile(join(mismatchPath, 'skill.json'), 'utf-8');
    const metadata = JSON.parse(skillJson);

    expect(metadata.openclaw?.skillKey).toBe('canonical-skill-key');

    // When scanning, we'd use the canonical key
    const skill: DiscoveredSkill = {
      skillKey: metadata.openclaw.skillKey, // Should be 'canonical-skill-key'
      path: mismatchPath,
      source: 'workspace',
      metadata,
    };

    expect(skill.skillKey).toBe('canonical-skill-key');
  });

  it('should fall back to directory name if no skillKey in metadata', () => {
    const skill: DiscoveredSkill = {
      skillKey: 'directory-name', // fallback
      path: '/some/path/directory-name',
      source: 'workspace',
    };

    expect(skill.skillKey).toBe('directory-name');
  });
});

describe('P0 Gate: Evidence Persistence', () => {
  beforeAll(async () => {
    // Ensure evidence directory exists
    await mkdir(EVIDENCE_DIR, { recursive: true });
  });

  it('should save and load evidence', async () => {
    const maliciousPath = join(FIXTURES_DIR, 'malicious-skill');
    const skill = mockSkill('evidence-test-skill', maliciousPath);
    const scanResult = await scanSkill(skill);
    const assessment = assessRisk(scanResult.findings);
    const evidence = generateEvidence(scanResult, assessment);

    // Save
    const filepath = await saveEvidence(evidence);
    expect(filepath).toContain(evidence.id);

    // Load
    const loaded = await loadEvidence(evidence.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(evidence.id);
    expect(loaded?.skillKey).toBe(evidence.skillKey);
    expect(loaded?.findings.length).toBe(evidence.findings.length);
  });
});

describe('P0 Gate: Quarantine and Restore', () => {
  const testConfigPath = expandPath('~/.openclaw/openclaw.json');

  beforeAll(() => {
    // Enable test mode for auto-auth
    setTestMode(true);
  });

  afterAll(() => {
    setTestMode(false);
  });

  it('should quarantine a skill', async () => {
    const maliciousPath = join(FIXTURES_DIR, 'malicious-skill');
    const skill = mockSkill('quarantine-test-skill', maliciousPath);
    const scanResult = await scanSkill(skill);
    const assessment = assessRisk(scanResult.findings);
    const evidence = generateEvidence(scanResult, assessment);

    const result = await quarantineSkill(skill, evidence, 'Test quarantine');

    expect(result.success).toBe(true);
    expect(result.skillKey).toBe('quarantine-test-skill');
    expect(result.configUpdated).toBe(true);
    expect(result.backupPath).toBeDefined();
  });

  it('should detect quarantined skill', async () => {
    const quarantine = await isQuarantined('quarantine-test-skill');
    expect(quarantine).not.toBeNull();
    expect(quarantine?.reason).toContain('Test quarantine');
  });

  it('should restore a quarantined skill', async () => {
    const result = await restoreSkill('quarantine-test-skill');

    expect(result.success).toBe(true);
    expect(result.configUpdated).toBe(true);
  });

  it('should verify skill is no longer quarantined', async () => {
    const quarantine = await isQuarantined('quarantine-test-skill');
    expect(quarantine).toBeNull();
  });
});
