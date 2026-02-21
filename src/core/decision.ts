/**
 * Risk assessment with scoring model and combo detection
 */

import { Finding, Severity } from './scan.js';

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';

export type RecommendedAction = 'quarantine' | 'disable' | 'warn' | 'log' | 'none';

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  action: RecommendedAction;
  reasons: string[];
  combos: ComboMatch[];
}

export interface ComboMatch {
  name: string;
  description: string;
  scoreBonus: number;
  matchedRules: string[];
}

/**
 * Severity weights for base scoring
 */
const SEVERITY_WEIGHTS: Record<Severity, number> = {
  CRITICAL: 100,
  HIGH: 50,
  MEDIUM: 20,
  LOW: 5,
  INFO: 1,
};

/**
 * Combo definitions - dangerous combinations of findings
 */
const COMBOS: ComboDefinition[] = [
  {
    name: 'supply-chain-attack',
    description: 'Download + execute pattern detected',
    rules: ['curl-pipe-bash', 'wget-pipe-bash', 'download-execute'],
    minMatches: 1,
    scoreBonus: 100,
  },
  {
    name: 'obfuscated-execution',
    description: 'Obfuscated code with shell execution',
    rules: ['obfuscated-code', 'shell-exec', 'base64-pipe-bash'],
    minMatches: 2,
    scoreBonus: 80,
  },
  {
    name: 'credential-theft',
    description: 'Credential access with network exfiltration',
    rules: ['hardcoded-token', 'env-exfiltration', 'network-request'],
    minMatches: 2,
    scoreBonus: 70,
  },
  {
    name: 'destructive-payload',
    description: 'Destructive commands in install hook',
    rules: ['rm-rf-root', 'install-download', 'metadata-install-download'],
    minMatches: 1,
    scoreBonus: 100,
  },
  {
    name: 'install-hook-risky',
    description: 'Install hook with shell/network access',
    rules: ['install-download', 'metadata-install-download', 'shell-exec'],
    minMatches: 2,
    scoreBonus: 40,
  },
];

interface ComboDefinition {
  name: string;
  description: string;
  rules: string[];
  minMatches: number;
  scoreBonus: number;
}

/**
 * Assess risk based on findings
 */
export function assessRisk(findings: Finding[]): RiskAssessment {
  // Calculate base score from individual findings
  let baseScore = 0;
  const reasons: string[] = [];

  for (const finding of findings) {
    baseScore += SEVERITY_WEIGHTS[finding.severity];
    if (finding.severity === 'CRITICAL' || finding.severity === 'HIGH') {
      reasons.push(`${finding.severity}: ${finding.description} (${finding.file}:${finding.line})`);
    }
  }

  // Check for combos
  const matchedRules = new Set(findings.map((f) => f.rule));
  const combos: ComboMatch[] = [];

  for (const combo of COMBOS) {
    const matchedComboRules = combo.rules.filter((r) => matchedRules.has(r));
    if (matchedComboRules.length >= combo.minMatches) {
      combos.push({
        name: combo.name,
        description: combo.description,
        scoreBonus: combo.scoreBonus,
        matchedRules: matchedComboRules,
      });
      baseScore += combo.scoreBonus;
      reasons.push(`COMBO: ${combo.description}`);
    }
  }

  // Determine risk level and action
  const { level, action } = determineLevel(baseScore, findings);

  return {
    level,
    score: baseScore,
    action,
    reasons: reasons.slice(0, 10), // Limit reasons
    combos,
  };
}

/**
 * Determine risk level and recommended action from score
 */
function determineLevel(
  score: number,
  findings: Finding[]
): { level: RiskLevel; action: RecommendedAction } {
  // Any CRITICAL finding = CRITICAL level
  const hasCritical = findings.some((f) => f.severity === 'CRITICAL');
  if (hasCritical || score >= 200) {
    return { level: 'CRITICAL', action: 'quarantine' };
  }

  // Multiple HIGH or high score = HIGH level
  const highCount = findings.filter((f) => f.severity === 'HIGH').length;
  if (highCount >= 2 || score >= 100) {
    return { level: 'HIGH', action: 'disable' };
  }

  // Any HIGH or moderate score = MEDIUM
  if (highCount >= 1 || score >= 40) {
    return { level: 'MEDIUM', action: 'warn' };
  }

  // Low findings = LOW
  if (score > 0) {
    return { level: 'LOW', action: 'log' };
  }

  return { level: 'SAFE', action: 'none' };
}

/**
 * Check if a skill should be auto-quarantined
 */
export function shouldAutoQuarantine(assessment: RiskAssessment): boolean {
  return assessment.level === 'CRITICAL';
}

/**
 * Check if a skill should be auto-disabled
 */
export function shouldAutoDisable(assessment: RiskAssessment): boolean {
  return assessment.level === 'HIGH';
}

/**
 * Format risk assessment for display
 */
export function formatAssessment(assessment: RiskAssessment): string {
  const lines: string[] = [];

  lines.push(`Risk Level: ${assessment.level} (score: ${assessment.score})`);
  lines.push(`Recommended Action: ${assessment.action}`);

  if (assessment.combos.length > 0) {
    lines.push('\nCombos Detected:');
    for (const combo of assessment.combos) {
      lines.push(`  - ${combo.name}: ${combo.description}`);
    }
  }

  if (assessment.reasons.length > 0) {
    lines.push('\nReasons:');
    for (const reason of assessment.reasons) {
      lines.push(`  - ${reason}`);
    }
  }

  return lines.join('\n');
}
