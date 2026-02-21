/**
 * Three-layer skill discovery: workspace, managed, extraDirs
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import JSON5 from 'json5';
import { expandPath, readJson5Config, OPENCLAW_CONFIG_PATH } from './utils.js';

export type SkillSource = 'workspace' | 'managed' | 'extraDirs';

export interface DiscoveredSkill {
  /** Canonical skill key (from metadata or directory name) */
  skillKey: string;
  /** Absolute path to skill directory */
  path: string;
  /** Where the skill was discovered */
  source: SkillSource;
  /** Skill metadata if available */
  metadata?: SkillMetadata;
}

export interface SkillMetadata {
  name?: string;
  version?: string;
  description?: string;
  openclaw?: {
    skillKey?: string;
    install?: string; // download = HIGH/CRITICAL risk
  };
}

interface OpenClawConfig {
  skills?: {
    dirs?: string[];
    entries?: Record<string, unknown>;
  };
}

/**
 * Discover all skills from three sources
 */
export async function discoverSkills(): Promise<DiscoveredSkill[]> {
  const skills: DiscoveredSkill[] = [];

  // 1. Workspace skills (current directory)
  const workspaceSkills = await discoverInDirectory(process.cwd(), 'workspace');
  skills.push(...workspaceSkills);

  // 2. Managed skills (~/.openclaw/skills)
  const managedDir = expandPath('~/.openclaw/skills');
  const managedSkills = await discoverInDirectory(managedDir, 'managed');
  skills.push(...managedSkills);

  // 3. Extra dirs from config
  const config = await readJson5Config<OpenClawConfig>(OPENCLAW_CONFIG_PATH);
  if (config?.skills?.dirs) {
    for (const dir of config.skills.dirs) {
      const extraSkills = await discoverInDirectory(expandPath(dir), 'extraDirs');
      skills.push(...extraSkills);
    }
  }

  return skills;
}

/**
 * Discover skills in a directory
 */
async function discoverInDirectory(
  dir: string,
  source: SkillSource
): Promise<DiscoveredSkill[]> {
  const skills: DiscoveredSkill[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;

      const skillPath = join(dir, entry.name);
      const skill = await loadSkill(skillPath, source);
      if (skill) {
        skills.push(skill);
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }

  return skills;
}

/**
 * Load a single skill from a directory
 */
async function loadSkill(
  skillPath: string,
  source: SkillSource
): Promise<DiscoveredSkill | null> {
  // Check for skill markers
  const markers = [
    'skill.json',
    'skill.yaml',
    'skill.yml',
    'package.json',
    'openclaw.skill.json',
  ];

  let hasMarker = false;
  let metadata: SkillMetadata | undefined;

  for (const marker of markers) {
    try {
      const markerPath = join(skillPath, marker);
      const content = await readFile(markerPath, 'utf-8');

      hasMarker = true;

      // Parse metadata
      if (marker.endsWith('.json')) {
        metadata = JSON5.parse(content);
      }
      break;
    } catch {
      // Marker not found, continue
    }
  }

  if (!hasMarker) {
    return null;
  }

  // Determine canonical skillKey
  // Priority: metadata.openclaw.skillKey > metadata.name > directory name
  let skillKey = basename(skillPath);

  if (metadata?.openclaw?.skillKey) {
    skillKey = metadata.openclaw.skillKey;
  } else if (metadata?.name) {
    skillKey = metadata.name;
  }

  return {
    skillKey,
    path: skillPath,
    source,
    metadata,
  };
}

/**
 * Find a specific skill by key
 */
export async function findSkillByKey(
  skillKey: string
): Promise<DiscoveredSkill | null> {
  const skills = await discoverSkills();
  return skills.find((s) => s.skillKey === skillKey) || null;
}
