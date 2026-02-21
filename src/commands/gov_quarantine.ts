/**
 * /gov quarantine command - Quarantine a risky skill
 */

import { findSkillByKey } from '../core/discover.js';
import { scanSkill } from '../core/scan.js';
import { assessRisk } from '../core/decision.js';
import { generateEvidence, saveEvidence } from '../core/evidence.js';
import { quarantineSkill, isQuarantined, QuarantineResult } from '../core/actions.js';
import { requireAuthWithTest } from '../core/authz.js';

export interface GovQuarantineResult {
  success: boolean;
  skillKey: string;
  message: string;
  evidenceId?: string;
  backupPath?: string;
}

/**
 * Execute /gov quarantine command
 */
export async function govQuarantine(skillKey: string): Promise<GovQuarantineResult> {
  // Check if already quarantined
  const existing = await isQuarantined(skillKey);
  if (existing) {
    return {
      success: false,
      skillKey,
      message: `Skill "${skillKey}" is already quarantined (since ${existing.timestamp})`,
    };
  }

  // Find the skill
  const skill = await findSkillByKey(skillKey);
  if (!skill) {
    return {
      success: false,
      skillKey,
      message: `Skill "${skillKey}" not found in any source`,
    };
  }

  // Scan to get current risk assessment
  const scanResult = await scanSkill(skill);
  const assessment = assessRisk(scanResult.findings);

  // Generate evidence
  const evidence = generateEvidence(scanResult, assessment);
  await saveEvidence(evidence);

  // Require authorization
  const authResult = await requireAuthWithTest({
    action: 'quarantine',
    skillKey,
    riskLevel: assessment.level,
    evidenceId: evidence.id,
  });

  if (!authResult.authorized) {
    return {
      success: false,
      skillKey,
      message: 'Quarantine cancelled: authorization denied',
      evidenceId: evidence.id,
    };
  }

  // Execute quarantine
  const result = await quarantineSkill(
    skill,
    evidence,
    `Manual quarantine: ${assessment.level} risk`
  );

  console.log('');
  if (result.success) {
    console.log(`✅ ${result.message}`);
    console.log(`   Evidence: ${evidence.id}`);
    if (result.backupPath) {
      console.log(`   Backup: ${result.backupPath}`);
    }
    console.log('\n⚠️  Changes take effect in new sessions or after restart.');
  } else {
    console.log(`❌ ${result.message}`);
  }

  return {
    success: result.success,
    skillKey,
    message: result.message,
    evidenceId: evidence.id,
    backupPath: result.backupPath,
  };
}
