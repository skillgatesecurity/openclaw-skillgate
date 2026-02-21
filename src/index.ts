/**
 * SkillGate - OpenClaw Skill Supply-Chain Governance Plugin
 *
 * Main entry point for the plugin.
 */

export { discoverSkills, SkillSource, DiscoveredSkill } from './core/discover.js';
export { scanSkill, ScanResult, Finding } from './core/scan.js';
export { assessRisk, RiskLevel, RiskAssessment } from './core/decision.js';
export { quarantineSkill, restoreSkill, disableSkill } from './core/actions.js';
export { generateEvidence, Evidence, RedactedSnippet } from './core/evidence.js';
export { redactSnippet, hashContent } from './core/redaction.js';
export { requireAuth, AuthResult } from './core/authz.js';

// Command handlers
export { govScan } from './commands/gov_scan.js';
export { govQuarantine } from './commands/gov_quarantine.js';
export { govRestore } from './commands/gov_restore.js';
export { govAllow } from './commands/gov_allow.js';
export { govExplain } from './commands/gov_explain.js';
export { govStatus } from './commands/gov_status.js';

// Plugin metadata
export const PLUGIN_NAME = 'skillgate';
export const PLUGIN_VERSION = '0.1.0';
