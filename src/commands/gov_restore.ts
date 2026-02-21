/**
 * /gov restore command - Restore a quarantined skill
 */

import { isQuarantined, restoreSkill } from '../core/actions.js';
import { requireAuthWithTest } from '../core/authz.js';
import { loadEvidence } from '../core/evidence.js';

export interface GovRestoreResult {
  success: boolean;
  skillKey: string;
  message: string;
  previousQuarantine?: {
    timestamp: string;
    reason: string;
    evidenceId: string;
  };
}

/**
 * Execute /gov restore command
 */
export async function govRestore(skillKey: string): Promise<GovRestoreResult> {
  // Check if quarantined
  const quarantine = await isQuarantined(skillKey);
  if (!quarantine) {
    return {
      success: false,
      skillKey,
      message: `Skill "${skillKey}" is not quarantined`,
    };
  }

  // Show previous quarantine info
  console.log('');
  console.log(`Skill "${skillKey}" was quarantined:`);
  console.log(`  Timestamp: ${quarantine.timestamp}`);
  console.log(`  Reason: ${quarantine.reason}`);
  console.log(`  Evidence: ${quarantine.evidenceId}`);

  // Load and show evidence summary
  const evidence = await loadEvidence(quarantine.evidenceId);
  if (evidence) {
    console.log(`  Risk Level: ${evidence.riskLevel} (score: ${evidence.riskScore})`);
    console.log(`  Findings: ${evidence.findings.length}`);
  }

  console.log('');

  // Require authorization
  const authResult = await requireAuthWithTest({
    action: 'restore',
    skillKey,
    evidenceId: quarantine.evidenceId,
  });

  if (!authResult.authorized) {
    return {
      success: false,
      skillKey,
      message: 'Restore cancelled: authorization denied',
      previousQuarantine: quarantine,
    };
  }

  // Execute restore
  const result = await restoreSkill(skillKey);

  if (result.success) {
    console.log(`✅ ${result.message}`);
    console.log('\n⚠️  Changes take effect in new sessions or after restart.');
  } else {
    console.log(`❌ ${result.message}`);
  }

  return {
    success: result.success,
    skillKey,
    message: result.message,
    previousQuarantine: quarantine,
  };
}
