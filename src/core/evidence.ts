/**
 * Evidence generation and storage
 */

import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ScanResult, Finding } from './scan.js';
import { RiskAssessment } from './decision.js';
import { redactSnippet, hashContent, RedactedContent } from './redaction.js';
import { EVIDENCE_DIR, generateEvidenceId, nowISO } from './utils.js';

export interface Evidence {
  id: string;
  skillKey: string;
  skillPath: string;
  scanTimestamp: string;
  riskLevel: string;
  riskScore: number;
  recommendedAction: string;
  findings: RedactedFinding[];
  combos: string[];
  scannedFiles: number;
  scanDuration: number;
}

export interface RedactedFinding {
  rule: string;
  severity: string;
  file: string;
  line: number;
  description: string;
  snippet_redacted: boolean;
  snippet_hash: string;
  redaction_applied: boolean;
}

export interface RedactedSnippet {
  redacted: true;
  hash: string;
  originalLength: number;
}

/**
 * Generate evidence package from scan result
 */
export function generateEvidence(
  scanResult: ScanResult,
  assessment: RiskAssessment
): Evidence {
  const id = generateEvidenceId();

  const redactedFindings: RedactedFinding[] = scanResult.findings.map((f) => {
    const snippetRedaction = redactSnippet(f.match);
    return {
      rule: f.rule,
      severity: f.severity,
      file: f.file,
      line: f.line,
      description: f.description,
      snippet_redacted: true,
      snippet_hash: snippetRedaction.hash,
      redaction_applied: true,
    };
  });

  return {
    id,
    skillKey: scanResult.skill.skillKey,
    skillPath: scanResult.skill.path,
    scanTimestamp: nowISO(),
    riskLevel: assessment.level,
    riskScore: assessment.score,
    recommendedAction: assessment.action,
    findings: redactedFindings,
    combos: assessment.combos.map((c) => c.name),
    scannedFiles: scanResult.scannedFiles,
    scanDuration: scanResult.scanDuration,
  };
}

/**
 * Save evidence to disk
 */
export async function saveEvidence(evidence: Evidence): Promise<string> {
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const filename = `${evidence.id}.json`;
  const filepath = join(EVIDENCE_DIR, filename);

  await writeFile(filepath, JSON.stringify(evidence, null, 2), 'utf-8');

  return filepath;
}

/**
 * Load evidence by ID
 */
export async function loadEvidence(evidenceId: string): Promise<Evidence | null> {
  try {
    const filepath = join(EVIDENCE_DIR, `${evidenceId}.json`);
    const content = await readFile(filepath, 'utf-8');
    return JSON.parse(content) as Evidence;
  } catch {
    return null;
  }
}

/**
 * Find evidence for a skill
 */
export async function findEvidenceForSkill(skillKey: string): Promise<Evidence[]> {
  const evidence: Evidence[] = [];

  try {
    const files = await readdir(EVIDENCE_DIR);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filepath = join(EVIDENCE_DIR, file);
      const content = await readFile(filepath, 'utf-8');
      const ev = JSON.parse(content) as Evidence;

      if (ev.skillKey === skillKey) {
        evidence.push(ev);
      }
    }
  } catch {
    // Evidence dir doesn't exist
  }

  // Sort by timestamp descending
  evidence.sort((a, b) => b.scanTimestamp.localeCompare(a.scanTimestamp));

  return evidence;
}

/**
 * Format evidence for display
 */
export function formatEvidence(evidence: Evidence): string {
  const lines: string[] = [];

  lines.push(`Evidence ID: ${evidence.id}`);
  lines.push(`Skill: ${evidence.skillKey}`);
  lines.push(`Scan Time: ${evidence.scanTimestamp}`);
  lines.push(`Risk Level: ${evidence.riskLevel} (score: ${evidence.riskScore})`);
  lines.push(`Action: ${evidence.recommendedAction}`);
  lines.push(`Files Scanned: ${evidence.scannedFiles}`);

  if (evidence.combos.length > 0) {
    lines.push(`\nCombos: ${evidence.combos.join(', ')}`);
  }

  lines.push(`\nFindings: ${evidence.findings.length}`);
  for (const f of evidence.findings.slice(0, 5)) {
    lines.push(`  - [${f.severity}] ${f.rule} in ${f.file}:${f.line}`);
    lines.push(`    ${f.description}`);
  }

  if (evidence.findings.length > 5) {
    lines.push(`  ... and ${evidence.findings.length - 5} more`);
  }

  return lines.join('\n');
}
