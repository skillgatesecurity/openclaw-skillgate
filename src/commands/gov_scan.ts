/**
 * /gov scan command - Scan skills for security risks
 */

import { discoverSkills, DiscoveredSkill } from '../core/discover.js';
import { scanSkill, ScanResult, Finding, Severity } from '../core/scan.js';
import { assessRisk, RiskAssessment, shouldAutoQuarantine, shouldAutoDisable } from '../core/decision.js';
import { generateEvidence, saveEvidence, Evidence } from '../core/evidence.js';
import { quarantineSkill, disableSkill, isAllowlisted } from '../core/actions.js';
import { requireAuthWithTest } from '../core/authz.js';

export interface ScanOptions {
  /** Show all findings including LOW/INFO (default: HIGH+) */
  all?: boolean;
  /** Output as JSON */
  json?: boolean;
  /** Auto-apply actions (quarantine/disable) without prompting */
  autoApply?: boolean;
}

export interface GovScanResult {
  totalSkills: number;
  scannedSkills: number;
  skippedSkills: number;
  findings: SkillFindingSummary[];
  actionsApplied: ActionApplied[];
}

export interface SkillFindingSummary {
  skillKey: string;
  source: string;
  riskLevel: string;
  score: number;
  findingCount: number;
  criticalCount: number;
  highCount: number;
  evidenceId?: string;
}

export interface ActionApplied {
  skillKey: string;
  action: 'quarantine' | 'disable' | 'warn';
  success: boolean;
  message: string;
}

/**
 * Execute /gov scan command
 */
export async function govScan(options: ScanOptions = {}): Promise<GovScanResult> {
  const skills = await discoverSkills();
  const result: GovScanResult = {
    totalSkills: skills.length,
    scannedSkills: 0,
    skippedSkills: 0,
    findings: [],
    actionsApplied: [],
  };

  for (const skill of skills) {
    // Check allowlist
    if (await isAllowlisted(skill.skillKey)) {
      result.skippedSkills++;
      continue;
    }

    // Scan
    const scanResult = await scanSkill(skill);
    const assessment = assessRisk(scanResult.findings);

    result.scannedSkills++;

    // Filter findings by severity unless --all
    const relevantFindings = options.all
      ? scanResult.findings
      : scanResult.findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');

    if (relevantFindings.length === 0 && !options.all) {
      continue;
    }

    // Generate evidence for HIGH+ risks
    let evidence: Evidence | undefined;
    if (assessment.level === 'CRITICAL' || assessment.level === 'HIGH' || assessment.level === 'MEDIUM') {
      evidence = generateEvidence(scanResult, assessment);
      await saveEvidence(evidence);
    }

    // Record summary
    result.findings.push({
      skillKey: skill.skillKey,
      source: skill.source,
      riskLevel: assessment.level,
      score: assessment.score,
      findingCount: scanResult.findings.length,
      criticalCount: scanResult.findings.filter((f) => f.severity === 'CRITICAL').length,
      highCount: scanResult.findings.filter((f) => f.severity === 'HIGH').length,
      evidenceId: evidence?.id,
    });

    // Apply automatic actions if needed
    if (shouldAutoQuarantine(assessment)) {
      const authResult = await requireAuthWithTest({
        action: 'quarantine',
        skillKey: skill.skillKey,
        riskLevel: assessment.level,
        evidenceId: evidence?.id,
      });

      if (authResult.authorized && evidence) {
        const qResult = await quarantineSkill(
          skill,
          evidence,
          `Auto-quarantine: ${assessment.level} risk`
        );
        result.actionsApplied.push({
          skillKey: skill.skillKey,
          action: 'quarantine',
          success: qResult.success,
          message: qResult.message,
        });
      }
    } else if (shouldAutoDisable(assessment)) {
      const authResult = await requireAuthWithTest({
        action: 'disable',
        skillKey: skill.skillKey,
        riskLevel: assessment.level,
        evidenceId: evidence?.id,
      });

      if (authResult.authorized) {
        const dResult = await disableSkill(skill, `Auto-disable: ${assessment.level} risk`);
        result.actionsApplied.push({
          skillKey: skill.skillKey,
          action: 'disable',
          success: dResult.success,
          message: dResult.message,
        });
      }
    }
  }

  // Output
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printScanResult(result, options);
  }

  return result;
}

/**
 * Print scan result in human-readable format
 */
function printScanResult(result: GovScanResult, options: ScanOptions): void {
  console.log('\n📋 SkillGate Scan Results');
  console.log('─'.repeat(50));
  console.log(`Skills: ${result.scannedSkills} scanned, ${result.skippedSkills} skipped (allowlisted)`);
  console.log('');

  if (result.findings.length === 0) {
    console.log('✅ No risks found' + (options.all ? '' : ' (HIGH+)'));
    return;
  }

  // Sort by risk level
  const levelOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, SAFE: 4 };
  result.findings.sort((a, b) => levelOrder[a.riskLevel as keyof typeof levelOrder] - levelOrder[b.riskLevel as keyof typeof levelOrder]);

  for (const finding of result.findings) {
    const icon = getRiskIcon(finding.riskLevel);
    console.log(`${icon} ${finding.skillKey} [${finding.source}]`);
    console.log(`   Risk: ${finding.riskLevel} (score: ${finding.score})`);
    console.log(`   Findings: ${finding.findingCount} total (${finding.criticalCount} CRITICAL, ${finding.highCount} HIGH)`);
    if (finding.evidenceId) {
      console.log(`   Evidence: ${finding.evidenceId}`);
    }
    console.log('');
  }

  // Actions applied
  if (result.actionsApplied.length > 0) {
    console.log('─'.repeat(50));
    console.log('Actions Applied:');
    for (const action of result.actionsApplied) {
      const status = action.success ? '✓' : '✗';
      console.log(`  ${status} ${action.action}: ${action.skillKey}`);
      console.log(`    ${action.message}`);
    }
    console.log('\n⚠️  Changes take effect in new sessions or after restart.');
  }
}

function getRiskIcon(level: string): string {
  switch (level) {
    case 'CRITICAL': return '🔴';
    case 'HIGH': return '🟠';
    case 'MEDIUM': return '🟡';
    case 'LOW': return '🔵';
    default: return '⚪';
  }
}
