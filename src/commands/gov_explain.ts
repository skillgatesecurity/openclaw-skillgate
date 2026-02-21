/**
 * /gov explain command - Explain why a skill was flagged
 */

import { findSkillByKey } from '../core/discover.js';
import { scanSkill } from '../core/scan.js';
import { assessRisk, formatAssessment } from '../core/decision.js';
import { findEvidenceForSkill } from '../core/evidence.js';
import { isQuarantined, isAllowlisted, getSkillStatus } from '../core/actions.js';

export interface GovExplainResult {
  skillKey: string;
  found: boolean;
  status: 'quarantined' | 'allowlisted' | 'enabled' | 'disabled' | 'unknown';
  riskLevel?: string;
  score?: number;
  findings?: ExplainedFinding[];
  evidenceHistory?: string[];
}

export interface ExplainedFinding {
  rule: string;
  severity: string;
  file: string;
  line: number;
  description: string;
  explanation: string;
}

/**
 * Execute /gov explain command
 */
export async function govExplain(skillKey: string): Promise<GovExplainResult> {
  const result: GovExplainResult = {
    skillKey,
    found: false,
    status: 'unknown',
  };

  // Check current status
  const quarantine = await isQuarantined(skillKey);
  const allowlisted = await isAllowlisted(skillKey);
  const skillStatus = await getSkillStatus(skillKey);

  if (quarantine) {
    result.status = 'quarantined';
  } else if (allowlisted) {
    result.status = 'allowlisted';
  } else if (skillStatus?.enabled === false) {
    result.status = 'disabled';
  } else if (skillStatus?.enabled === true) {
    result.status = 'enabled';
  }

  // Find the skill
  const skill = await findSkillByKey(skillKey);

  console.log('');
  console.log(`📋 Skill: ${skillKey}`);
  console.log('─'.repeat(50));

  if (!skill) {
    console.log(`Status: ${result.status}`);
    console.log('Skill not found in any source (may have been removed)');

    // Check for historical evidence
    const evidence = await findEvidenceForSkill(skillKey);
    if (evidence.length > 0) {
      console.log('\n📁 Historical Evidence:');
      for (const ev of evidence.slice(0, 3)) {
        console.log(`  - ${ev.id} (${ev.scanTimestamp}): ${ev.riskLevel}`);
      }
      result.evidenceHistory = evidence.map((e) => e.id);
    }

    return result;
  }

  result.found = true;
  console.log(`Source: ${skill.source}`);
  console.log(`Path: ${skill.path}`);
  console.log(`Status: ${result.status}`);

  // Scan for current findings
  const scanResult = await scanSkill(skill);
  const assessment = assessRisk(scanResult.findings);

  result.riskLevel = assessment.level;
  result.score = assessment.score;

  console.log('');
  console.log('📊 Current Risk Assessment:');
  console.log(formatAssessment(assessment));

  // Detailed findings
  if (scanResult.findings.length > 0) {
    console.log('\n📍 Detailed Findings:');
    result.findings = [];

    for (const finding of scanResult.findings) {
      const explanation = explainRule(finding.rule);
      result.findings.push({
        rule: finding.rule,
        severity: finding.severity,
        file: finding.file,
        line: finding.line,
        description: finding.description,
        explanation,
      });

      console.log(`\n  [${finding.severity}] ${finding.rule}`);
      console.log(`  File: ${finding.file}:${finding.line}`);
      console.log(`  ${finding.description}`);
      console.log(`  Why: ${explanation}`);
    }
  }

  // Historical evidence
  const evidence = await findEvidenceForSkill(skillKey);
  if (evidence.length > 0) {
    console.log('\n📁 Scan History:');
    for (const ev of evidence.slice(0, 5)) {
      console.log(`  - ${ev.id} (${ev.scanTimestamp}): ${ev.riskLevel} (${ev.findings.length} findings)`);
    }
    result.evidenceHistory = evidence.map((e) => e.id);
  }

  return result;
}

/**
 * Get human-readable explanation for a rule
 */
function explainRule(ruleId: string): string {
  const explanations: Record<string, string> = {
    'curl-pipe-bash':
      'This pattern downloads and executes code in one step, bypassing review. Attackers can modify the remote script at any time.',
    'wget-pipe-bash':
      'Same as curl|bash - downloading and executing untrusted code is a supply-chain attack vector.',
    'base64-pipe-bash':
      'Obfuscating code with base64 then executing it hides the payload from review.',
    'rm-rf-root':
      'Deleting from root or home directory can destroy your system or user data.',
    'eval-remote':
      'Fetching code and evaluating it allows remote code execution.',
    'download-execute':
      'The download-then-execute pattern is a classic supply-chain attack.',
    'env-exfiltration':
      'Sending environment variables over network can leak API keys and secrets.',
    'hardcoded-token':
      'Hardcoded secrets in source code are exposed to anyone with repo access.',
    'shell-spawn-untrusted':
      'Using template literals in shell commands enables injection attacks.',
    'install-download':
      'Download during install runs before user can review the skill.',
    'metadata-install-download':
      'Install hook that downloads content runs automatically on skill install.',
    'dynamic-require':
      'Dynamic requires can load unexpected modules based on user input.',
    'fs-write-root':
      'Writing to system directories can overwrite critical files.',
    'network-listener':
      'Creating a server may expose your machine to network attacks.',
    'obfuscated-code':
      'Heavy obfuscation often indicates an attempt to hide malicious code.',
    'shell-exec':
      'Shell execution is powerful but can be dangerous if inputs are not sanitized.',
    'network-request':
      'Network requests may send data to external servers.',
    'file-system-access':
      'File system access requires trust - the skill can read/write your files.',
  };

  return explanations[ruleId] || 'This pattern may indicate risky behavior.';
}
