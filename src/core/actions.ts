/**
 * Governance actions: quarantine, restore, disable, allow
 */

import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DiscoveredSkill } from './discover.js';
import { Evidence } from './evidence.js';
import {
  OPENCLAW_CONFIG_PATH,
  expandPath,
  nowISO,
  atomicWriteJson,
  readJson5Config,
} from './utils.js';

export interface QuarantineResult {
  success: boolean;
  skillKey: string;
  backupPath?: string;
  configUpdated: boolean;
  message: string;
}

export interface RestoreResult {
  success: boolean;
  skillKey: string;
  configUpdated: boolean;
  message: string;
}

interface OpenClawConfig {
  skills?: {
    dirs?: string[];
    entries?: Record<string, SkillEntry>;
  };
  [key: string]: unknown;
}

interface SkillEntry {
  enabled?: boolean;
  path?: string;
  _quarantine?: QuarantineInfo;
  _allowlisted?: boolean;
  [key: string]: unknown;
}

interface QuarantineInfo {
  timestamp: string;
  reason: string;
  evidenceId: string;
  backupPath?: string;
}

/**
 * Quarantine a skill (backup + disable)
 */
export async function quarantineSkill(
  skill: DiscoveredSkill,
  evidence: Evidence,
  reason: string
): Promise<QuarantineResult> {
  try {
    // 1. Create backup
    const backupDir = expandPath('~/.openclaw/quarantine');
    await mkdir(backupDir, { recursive: true });

    const backupPath = join(backupDir, `${skill.skillKey}-${Date.now()}`);
    await mkdir(backupPath, { recursive: true });

    // Copy skill metadata (not entire directory for safety)
    const metaFiles = ['skill.json', 'package.json', 'openclaw.skill.json'];
    for (const file of metaFiles) {
      try {
        const src = join(skill.path, file);
        const dst = join(backupPath, file);
        await copyFile(src, dst);
      } catch {
        // File doesn't exist, skip
      }
    }

    // 2. Update config
    const config = await loadOrCreateConfig();

    if (!config.skills) {
      config.skills = {};
    }
    if (!config.skills.entries) {
      config.skills.entries = {};
    }

    config.skills.entries[skill.skillKey] = {
      ...config.skills.entries[skill.skillKey],
      enabled: false,
      _quarantine: {
        timestamp: nowISO(),
        reason,
        evidenceId: evidence.id,
        backupPath,
      },
    };

    await saveConfig(config);

    return {
      success: true,
      skillKey: skill.skillKey,
      backupPath,
      configUpdated: true,
      message: `Quarantined "${skill.skillKey}". Changes take effect after restart.`,
    };
  } catch (error) {
    return {
      success: false,
      skillKey: skill.skillKey,
      configUpdated: false,
      message: `Failed to quarantine: ${error}`,
    };
  }
}

/**
 * Restore a quarantined skill
 */
export async function restoreSkill(skillKey: string): Promise<RestoreResult> {
  try {
    const config = await loadOrCreateConfig();

    if (!config.skills?.entries?.[skillKey]) {
      return {
        success: false,
        skillKey,
        configUpdated: false,
        message: `Skill "${skillKey}" not found in config`,
      };
    }

    const entry = config.skills.entries[skillKey];

    if (!entry._quarantine) {
      return {
        success: false,
        skillKey,
        configUpdated: false,
        message: `Skill "${skillKey}" is not quarantined`,
      };
    }

    // Remove quarantine and re-enable
    delete entry._quarantine;
    entry.enabled = true;

    await saveConfig(config);

    return {
      success: true,
      skillKey,
      configUpdated: true,
      message: `Restored "${skillKey}". Changes take effect after restart.`,
    };
  } catch (error) {
    return {
      success: false,
      skillKey,
      configUpdated: false,
      message: `Failed to restore: ${error}`,
    };
  }
}

/**
 * Disable a skill (soft disable without quarantine)
 */
export async function disableSkill(
  skill: DiscoveredSkill,
  _reason: string
): Promise<QuarantineResult> {
  try {
    const config = await loadOrCreateConfig();

    if (!config.skills) {
      config.skills = {};
    }
    if (!config.skills.entries) {
      config.skills.entries = {};
    }

    config.skills.entries[skill.skillKey] = {
      ...config.skills.entries[skill.skillKey],
      enabled: false,
    };

    await saveConfig(config);

    return {
      success: true,
      skillKey: skill.skillKey,
      configUpdated: true,
      message: `Disabled "${skill.skillKey}". Changes take effect after restart.`,
    };
  } catch (error) {
    return {
      success: false,
      skillKey: skill.skillKey,
      configUpdated: false,
      message: `Failed to disable: ${error}`,
    };
  }
}

/**
 * Allowlist a skill (skip future scans)
 */
export async function allowlistSkill(skillKey: string): Promise<RestoreResult> {
  try {
    const config = await loadOrCreateConfig();

    if (!config.skills) {
      config.skills = {};
    }
    if (!config.skills.entries) {
      config.skills.entries = {};
    }

    config.skills.entries[skillKey] = {
      ...config.skills.entries[skillKey],
      enabled: true,
      _allowlisted: true,
    };

    await saveConfig(config);

    return {
      success: true,
      skillKey,
      configUpdated: true,
      message: `Allowlisted "${skillKey}". Future scans will skip this skill.`,
    };
  } catch (error) {
    return {
      success: false,
      skillKey,
      configUpdated: false,
      message: `Failed to allowlist: ${error}`,
    };
  }
}

/**
 * Check if a skill is allowlisted
 */
export async function isAllowlisted(skillKey: string): Promise<boolean> {
  const config = await loadOrCreateConfig();
  return config.skills?.entries?.[skillKey]?._allowlisted === true;
}

/**
 * Check if a skill is quarantined
 */
export async function isQuarantined(skillKey: string): Promise<QuarantineInfo | null> {
  const config = await loadOrCreateConfig();
  return config.skills?.entries?.[skillKey]?._quarantine || null;
}

/**
 * Get skill status from config
 */
export async function getSkillStatus(skillKey: string): Promise<SkillEntry | null> {
  const config = await loadOrCreateConfig();
  return config.skills?.entries?.[skillKey] || null;
}

/**
 * Load or create config
 */
async function loadOrCreateConfig(): Promise<OpenClawConfig> {
  const config = await readJson5Config<OpenClawConfig>(OPENCLAW_CONFIG_PATH);
  return config || {};
}

/**
 * Save config atomically
 */
async function saveConfig(config: OpenClawConfig): Promise<void> {
  await atomicWriteJson(OPENCLAW_CONFIG_PATH, config);
}
