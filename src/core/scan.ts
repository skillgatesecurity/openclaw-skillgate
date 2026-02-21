/**
 * File scanning for security risks
 */

import { readFile } from 'node:fs/promises';
import { relative, extname } from 'node:path';
import fg from 'fast-glob';
import { DiscoveredSkill } from './discover.js';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface Finding {
  rule: string;
  severity: Severity;
  file: string;
  line: number;
  column?: number;
  match: string;
  description: string;
}

export interface ScanResult {
  skill: DiscoveredSkill;
  findings: Finding[];
  scannedFiles: number;
  scanDuration: number;
}

interface Rule {
  id: string;
  severity: Severity;
  pattern: RegExp;
  description: string;
  fileTypes?: string[];
}

/**
 * Default rules for scanning
 */
const DEFAULT_RULES: Rule[] = [
  // CRITICAL: Shell injection / supply-chain attacks
  {
    id: 'curl-pipe-bash',
    severity: 'CRITICAL',
    pattern: /curl\s+[^\n]*\|\s*(bash|sh|zsh)/gi,
    description: 'Remote code execution via curl pipe to shell',
  },
  {
    id: 'wget-pipe-bash',
    severity: 'CRITICAL',
    pattern: /wget\s+[^\n]*\|\s*(bash|sh|zsh)/gi,
    description: 'Remote code execution via wget pipe to shell',
  },
  {
    id: 'base64-pipe-bash',
    severity: 'CRITICAL',
    pattern: /base64\s+(-d|--decode)[^\n]*\|\s*(bash|sh|zsh)/gi,
    description: 'Obfuscated code execution via base64 decode',
  },
  {
    id: 'rm-rf-root',
    severity: 'CRITICAL',
    pattern: /rm\s+-rf\s+(\/|~\/|\$HOME)/gi,
    description: 'Destructive command targeting root or home directory',
  },
  {
    id: 'eval-remote',
    severity: 'CRITICAL',
    pattern: /eval\s*\(\s*(fetch|axios|http|request)\s*\(/gi,
    description: 'Eval of remotely fetched content',
  },

  // HIGH: Dangerous patterns
  {
    id: 'download-execute',
    severity: 'HIGH',
    pattern: /(download|fetch|request)\s*\([^)]*\)\s*\.\s*then\s*\([^)]*\)\s*\.\s*(exec|spawn|eval)/gi,
    description: 'Download and execute pattern',
  },
  {
    id: 'env-exfiltration',
    severity: 'HIGH',
    pattern: /process\.env\s*\[?\s*['"][^'"]+['"]\s*\]?\s*\+\s*(fetch|axios|http|request)/gi,
    description: 'Potential environment variable exfiltration',
  },
  {
    id: 'hardcoded-token',
    severity: 'HIGH',
    pattern: /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9]{20,}['"]/gi,
    description: 'Hardcoded secret or API key',
  },
  {
    id: 'shell-spawn-untrusted',
    severity: 'HIGH',
    pattern: /(exec|spawn|execSync|spawnSync)\s*\(\s*[`'"]\s*\$\{/gi,
    description: 'Shell command with template literal (potential injection)',
  },
  {
    id: 'install-download',
    severity: 'HIGH',
    pattern: /"install"\s*:\s*["'].*\b(curl|wget|download|fetch)\b/gi,
    description: 'Install hook downloads external content',
    fileTypes: ['.json'],
  },

  // MEDIUM: Risky patterns
  {
    id: 'dynamic-require',
    severity: 'MEDIUM',
    pattern: /require\s*\(\s*[^'"]/gi,
    description: 'Dynamic require with non-literal argument',
  },
  {
    id: 'fs-write-root',
    severity: 'MEDIUM',
    pattern: /writeFile(Sync)?\s*\(\s*['"]\/(?!tmp)/gi,
    description: 'File write to root filesystem',
  },
  {
    id: 'network-listener',
    severity: 'MEDIUM',
    pattern: /\.(listen|createServer)\s*\(/gi,
    description: 'Creates network listener',
  },
  {
    id: 'obfuscated-code',
    severity: 'MEDIUM',
    pattern: /\\x[0-9a-f]{2}.*\\x[0-9a-f]{2}.*\\x[0-9a-f]{2}/gi,
    description: 'Potentially obfuscated code (hex escapes)',
  },

  // LOW: Informational
  {
    id: 'shell-exec',
    severity: 'LOW',
    pattern: /(exec|spawn|execSync|spawnSync|child_process)/gi,
    description: 'Uses shell execution',
  },
  {
    id: 'network-request',
    severity: 'LOW',
    pattern: /(fetch|axios|request|http\.get|https\.get)/gi,
    description: 'Makes network requests',
  },
  {
    id: 'file-system-access',
    severity: 'LOW',
    pattern: /(readFile|writeFile|readdir|mkdir|unlink|rmdir)/gi,
    description: 'Accesses file system',
  },
];

/**
 * Scan a skill for security issues
 */
export async function scanSkill(skill: DiscoveredSkill): Promise<ScanResult> {
  const startTime = Date.now();
  const findings: Finding[] = [];

  // Get all scannable files
  const files = await fg(['**/*.{js,ts,jsx,tsx,mjs,cjs,json,sh,bash,yaml,yml}'], {
    cwd: skill.path,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
    absolute: true,
  });

  for (const file of files) {
    const fileFindings = await scanFile(file, skill.path);
    findings.push(...fileFindings);
  }

  // Check metadata for install hook
  if (skill.metadata?.openclaw?.install) {
    const installCmd = skill.metadata.openclaw.install.toLowerCase();
    if (installCmd.includes('download') || installCmd.includes('curl') || installCmd.includes('wget')) {
      findings.push({
        rule: 'metadata-install-download',
        severity: 'HIGH',
        file: 'skill.json',
        line: 0,
        match: skill.metadata.openclaw.install,
        description: 'Install hook downloads external content',
      });
    }
  }

  return {
    skill,
    findings,
    scannedFiles: files.length,
    scanDuration: Date.now() - startTime,
  };
}

/**
 * Scan a single file
 */
async function scanFile(filepath: string, skillPath: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const ext = extname(filepath);

  try {
    const content = await readFile(filepath, 'utf-8');
    const relPath = relative(skillPath, filepath);

    for (const rule of DEFAULT_RULES) {
      // Skip if rule doesn't apply to this file type
      if (rule.fileTypes && !rule.fileTypes.includes(ext)) {
        continue;
      }

      // Reset regex state
      rule.pattern.lastIndex = 0;

      let match;
      while ((match = rule.pattern.exec(content)) !== null) {
        // Find line number
        const upToMatch = content.slice(0, match.index);
        const lineNum = upToMatch.split('\n').length;

        findings.push({
          rule: rule.id,
          severity: rule.severity,
          file: relPath,
          line: lineNum,
          match: match[0].slice(0, 100), // Truncate long matches
          description: rule.description,
        });
      }
    }
  } catch {
    // File not readable
  }

  return findings;
}

/**
 * Get rules for external use
 */
export function getRules(): Rule[] {
  return [...DEFAULT_RULES];
}
