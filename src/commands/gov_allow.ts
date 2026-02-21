/**
 * /gov allow command - Allowlist a skill
 */

import { findSkillByKey } from '../core/discover.js';
import { isAllowlisted, allowlistSkill } from '../core/actions.js';
import { requireAuthWithTest } from '../core/authz.js';

export interface GovAllowResult {
  success: boolean;
  skillKey: string;
  message: string;
}

/**
 * Execute /gov allow command
 */
export async function govAllow(skillKey: string): Promise<GovAllowResult> {
  // Check if already allowlisted
  if (await isAllowlisted(skillKey)) {
    return {
      success: false,
      skillKey,
      message: `Skill "${skillKey}" is already allowlisted`,
    };
  }

  // Find the skill (optional - we can allowlist skills that don't exist yet)
  const skill = await findSkillByKey(skillKey);

  console.log('');
  if (skill) {
    console.log(`Found skill "${skillKey}" in ${skill.source}`);
    console.log(`  Path: ${skill.path}`);
  } else {
    console.log(`Skill "${skillKey}" not found - will be allowlisted for future installs`);
  }
  console.log('');
  console.log('⚠️  Allowlisting will skip ALL future security scans for this skill.');
  console.log('   Only allowlist skills you have manually reviewed and trust.');
  console.log('');

  // Require authorization
  const authResult = await requireAuthWithTest({
    action: 'allow',
    skillKey,
  });

  if (!authResult.authorized) {
    return {
      success: false,
      skillKey,
      message: 'Allowlist cancelled: authorization denied',
    };
  }

  // Execute allowlist
  const result = await allowlistSkill(skillKey);

  if (result.success) {
    console.log(`✅ ${result.message}`);
  } else {
    console.log(`❌ ${result.message}`);
  }

  return {
    success: result.success,
    skillKey,
    message: result.message,
  };
}
