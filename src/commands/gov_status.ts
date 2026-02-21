/**
 * /gov status command - Show governance status for all skills
 */

import { discoverSkills } from '../core/discover.js';
import { isQuarantined, isAllowlisted, getSkillStatus } from '../core/actions.js';
import { findEvidenceForSkill } from '../core/evidence.js';

export interface SkillStatusEntry {
  skillKey: string;
  source: string;
  path: string;
  status: 'quarantined' | 'allowlisted' | 'enabled' | 'disabled' | 'unmanaged';
  quarantineInfo?: {
    timestamp: string;
    reason: string;
    evidenceId: string;
  };
  lastScan?: string;
  lastRiskLevel?: string;
}

export interface GovStatusResult {
  totalSkills: number;
  quarantinedCount: number;
  allowlistedCount: number;
  disabledCount: number;
  enabledCount: number;
  unmanagedCount: number;
  skills: SkillStatusEntry[];
}

/**
 * Execute /gov status command
 */
export async function govStatus(): Promise<GovStatusResult> {
  const skills = await discoverSkills();
  const result: GovStatusResult = {
    totalSkills: skills.length,
    quarantinedCount: 0,
    allowlistedCount: 0,
    disabledCount: 0,
    enabledCount: 0,
    unmanagedCount: 0,
    skills: [],
  };

  for (const skill of skills) {
    const quarantine = await isQuarantined(skill.skillKey);
    const allowlisted = await isAllowlisted(skill.skillKey);
    const configStatus = await getSkillStatus(skill.skillKey);
    const evidence = await findEvidenceForSkill(skill.skillKey);

    let status: SkillStatusEntry['status'];

    if (quarantine) {
      status = 'quarantined';
      result.quarantinedCount++;
    } else if (allowlisted) {
      status = 'allowlisted';
      result.allowlistedCount++;
    } else if (configStatus?.enabled === false) {
      status = 'disabled';
      result.disabledCount++;
    } else if (configStatus?.enabled === true) {
      status = 'enabled';
      result.enabledCount++;
    } else {
      status = 'unmanaged';
      result.unmanagedCount++;
    }

    const entry: SkillStatusEntry = {
      skillKey: skill.skillKey,
      source: skill.source,
      path: skill.path,
      status,
    };

    if (quarantine) {
      entry.quarantineInfo = {
        timestamp: quarantine.timestamp,
        reason: quarantine.reason,
        evidenceId: quarantine.evidenceId,
      };
    }

    if (evidence.length > 0) {
      entry.lastScan = evidence[0].scanTimestamp;
      entry.lastRiskLevel = evidence[0].riskLevel;
    }

    result.skills.push(entry);
  }

  // Print results
  console.log('\n📊 SkillGate Status');
  console.log('─'.repeat(50));
  console.log(`Total Skills: ${result.totalSkills}`);
  console.log(`  🔴 Quarantined: ${result.quarantinedCount}`);
  console.log(`  ✅ Allowlisted: ${result.allowlistedCount}`);
  console.log(`  🚫 Disabled: ${result.disabledCount}`);
  console.log(`  ✓  Enabled: ${result.enabledCount}`);
  console.log(`  ○  Unmanaged: ${result.unmanagedCount}`);
  console.log('');

  // Group by status
  const grouped: Record<string, SkillStatusEntry[]> = {
    quarantined: [],
    allowlisted: [],
    disabled: [],
    enabled: [],
    unmanaged: [],
  };

  for (const skill of result.skills) {
    grouped[skill.status].push(skill);
  }

  // Print quarantined first (most important)
  if (grouped.quarantined.length > 0) {
    console.log('🔴 Quarantined Skills:');
    for (const s of grouped.quarantined) {
      console.log(`   ${s.skillKey} [${s.source}]`);
      if (s.quarantineInfo) {
        console.log(`     Since: ${s.quarantineInfo.timestamp}`);
        console.log(`     Reason: ${s.quarantineInfo.reason}`);
      }
    }
    console.log('');
  }

  // Print allowlisted
  if (grouped.allowlisted.length > 0) {
    console.log('✅ Allowlisted Skills:');
    for (const s of grouped.allowlisted) {
      console.log(`   ${s.skillKey} [${s.source}]`);
    }
    console.log('');
  }

  // Print disabled
  if (grouped.disabled.length > 0) {
    console.log('🚫 Disabled Skills:');
    for (const s of grouped.disabled) {
      console.log(`   ${s.skillKey} [${s.source}]`);
      if (s.lastRiskLevel) {
        console.log(`     Last Risk: ${s.lastRiskLevel}`);
      }
    }
    console.log('');
  }

  // Brief summary of enabled/unmanaged
  if (grouped.enabled.length > 0 || grouped.unmanaged.length > 0) {
    console.log('Active Skills:');
    for (const s of [...grouped.enabled, ...grouped.unmanaged]) {
      const statusIcon = s.status === 'enabled' ? '✓' : '○';
      const riskInfo = s.lastRiskLevel ? ` (${s.lastRiskLevel})` : '';
      console.log(`   ${statusIcon} ${s.skillKey}${riskInfo}`);
    }
  }

  return result;
}
