/**
 * Authorization for write operations (fail-closed)
 */

import { createInterface } from 'node:readline';

export type AuthAction = 'quarantine' | 'restore' | 'allow' | 'disable';

export interface AuthResult {
  authorized: boolean;
  action: AuthAction;
  skillKey: string;
  timestamp: string;
  reason?: string;
}

export interface AuthContext {
  action: AuthAction;
  skillKey: string;
  riskLevel?: string;
  evidenceId?: string;
}

/**
 * Require authorization for a write operation
 * This is fail-closed: returns false by default
 */
export async function requireAuth(ctx: AuthContext): Promise<AuthResult> {
  // In non-interactive mode, always fail closed
  if (!process.stdin.isTTY) {
    return {
      authorized: false,
      action: ctx.action,
      skillKey: ctx.skillKey,
      timestamp: new Date().toISOString(),
      reason: 'Non-interactive mode: authorization denied',
    };
  }

  const prompt = buildPrompt(ctx);

  try {
    const confirmed = await confirmAction(prompt);

    return {
      authorized: confirmed,
      action: ctx.action,
      skillKey: ctx.skillKey,
      timestamp: new Date().toISOString(),
      reason: confirmed ? 'User confirmed' : 'User denied',
    };
  } catch {
    // Fail closed on any error
    return {
      authorized: false,
      action: ctx.action,
      skillKey: ctx.skillKey,
      timestamp: new Date().toISOString(),
      reason: 'Authorization failed (timeout or error)',
    };
  }
}

/**
 * Build confirmation prompt
 */
function buildPrompt(ctx: AuthContext): string {
  const lines: string[] = [];

  switch (ctx.action) {
    case 'quarantine':
      lines.push(`⚠️  QUARANTINE skill "${ctx.skillKey}"?`);
      if (ctx.riskLevel) {
        lines.push(`   Risk Level: ${ctx.riskLevel}`);
      }
      lines.push('   This will disable the skill and create a backup.');
      break;

    case 'restore':
      lines.push(`🔄 RESTORE skill "${ctx.skillKey}"?`);
      lines.push('   This will re-enable a quarantined skill.');
      break;

    case 'allow':
      lines.push(`✅ ALLOWLIST skill "${ctx.skillKey}"?`);
      lines.push('   This will skip future scans for this skill.');
      break;

    case 'disable':
      lines.push(`🚫 DISABLE skill "${ctx.skillKey}"?`);
      if (ctx.riskLevel) {
        lines.push(`   Risk Level: ${ctx.riskLevel}`);
      }
      break;
  }

  lines.push('');
  lines.push('Type "yes" to confirm, anything else to cancel:');

  return lines.join('\n');
}

/**
 * Prompt for confirmation
 */
async function confirmAction(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Timeout after 30 seconds (fail closed)
    const timeout = setTimeout(() => {
      rl.close();
      resolve(false);
    }, 30000);

    console.log(prompt);

    rl.question('> ', (answer) => {
      clearTimeout(timeout);
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Check if running in CI/non-interactive mode
 */
export function isNonInteractive(): boolean {
  return !process.stdin.isTTY || process.env.CI === 'true';
}

/**
 * Auto-authorize in test mode (for testing only)
 */
export function setTestMode(enabled: boolean): void {
  (globalThis as any).__skillgate_test_mode = enabled;
}

/**
 * Check if in test mode
 */
export function isTestMode(): boolean {
  return (globalThis as any).__skillgate_test_mode === true;
}

/**
 * Require auth with test mode support
 */
export async function requireAuthWithTest(ctx: AuthContext): Promise<AuthResult> {
  if (isTestMode()) {
    return {
      authorized: true,
      action: ctx.action,
      skillKey: ctx.skillKey,
      timestamp: new Date().toISOString(),
      reason: 'Test mode: auto-authorized',
    };
  }

  return requireAuth(ctx);
}
