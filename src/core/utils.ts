/**
 * Utility functions for SkillGate
 */

import { createHash, randomUUID } from 'node:crypto';
import { writeFile, rename, readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import JSON5 from 'json5';

/**
 * SHA-256 hash of content
 */
export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Generate a unique evidence ID
 */
export function generateEvidenceId(): string {
  return `ev-${randomUUID().slice(0, 8)}`;
}

/**
 * Expand ~ to home directory
 */
export function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

/**
 * Default OpenClaw config path
 */
export const OPENCLAW_CONFIG_PATH = expandPath('~/.openclaw/openclaw.json');

/**
 * Default evidence directory
 */
export const EVIDENCE_DIR = expandPath('~/.openclaw/evidence');

/**
 * Atomic write using tmp + rename pattern
 */
export async function atomicWriteJson(
  filepath: string,
  data: unknown
): Promise<void> {
  const dir = dirname(filepath);
  await mkdir(dir, { recursive: true });

  const tmpPath = `${filepath}.tmp.${Date.now()}`;
  const content = JSON.stringify(data, null, 2);

  await writeFile(tmpPath, content, 'utf-8');
  await rename(tmpPath, filepath);
}

/**
 * Read JSON5 config file (supports comments)
 */
export async function readJson5Config<T>(filepath: string): Promise<T | null> {
  try {
    const content = await readFile(filepath, 'utf-8');
    return JSON5.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Write JSON5 config preserving structure
 * Note: We write as JSON (subset of JSON5) for compatibility
 */
export async function writeJson5Config(
  filepath: string,
  data: unknown
): Promise<void> {
  await atomicWriteJson(filepath, data);
}

/**
 * Get current ISO timestamp
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}
