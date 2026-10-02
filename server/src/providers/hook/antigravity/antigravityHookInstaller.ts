/**
 * Hook installer for the Antigravity (AGY) provider.
 *
 * Unlike Claude Code — which installs a hook script into ~/.claude/settings.json —
 * Antigravity uses a PURE FILE-WATCHER approach. AGY already writes transcript
 * files to disk; Pixel Agents reads them directly without any hook script.
 *
 * "Installing hooks" for AGY means:
 *   1. Verifying the AGY brain directory exists and is readable.
 *   2. Registering the session root so Pixel Agents knows where to watch.
 *
 * There is nothing to uninstall — we never touch any AGY config files.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { AGY_BRAIN_SUBDIR } from './constants.js';

/** Absolute path to the AGY brain directory. */
export function getAgyBrainDir(): string {
  return path.join(os.homedir(), AGY_BRAIN_SUBDIR);
}

/**
 * "Install" for AGY = verify the brain directory is accessible.
 * No files are modified. Always resolves (never rejects on missing dir,
 * since AGY may not have been run yet — sessions appear as they start).
 */
export async function installHooks(_serverUrl: string, _authToken: string): Promise<void> {
  const brainDir = getAgyBrainDir();
  if (!fs.existsSync(brainDir)) {
    // Not an error — brain dir is created on first AGY run.
    console.log(
      `[Pixel Agents] AGY brain dir not found at ${brainDir}. ` +
        'Sessions will be detected when Antigravity runs.',
    );
  } else {
    console.log(`[Pixel Agents] AGY session watcher active: ${brainDir}`);
  }
}

/**
 * "Uninstall" for AGY = no-op (nothing was written).
 */
export async function uninstallHooks(): Promise<void> {
  // Nothing to remove.
  console.log('[Pixel Agents] AGY session watcher stopped (no files modified).');
}

/**
 * "Are hooks installed" for AGY = brain directory exists and is readable.
 * Returns true even if no sessions exist yet — watching an empty dir is valid.
 */
export function areHooksInstalled(): boolean {
  const brainDir = getAgyBrainDir();
  try {
    // Accessible = "hooks are ready"
    fs.accessSync(brainDir, fs.constants.R_OK);
    return true;
  } catch {
    // Dir doesn't exist yet — AGY hasn't run. Treated as "not yet installed"
    // so the user sees the one-time consent flow on first use.
    return false;
  }
}

/**
 * Return the directories that contain AGY session transcript files.
 * Each conversation is a subdirectory of the brain dir.
 *
 * Pixel Agents calls this for the active workspace. We return the specific
 * logs directory for each conversation under the brain dir, since that is
 * where transcript.jsonl lives.
 */
export function getSessionDirs(_workspacePath: string): string[] {
  const brainDir = getAgyBrainDir();
  try {
    if (!fs.existsSync(brainDir)) return [];
    return fs
      .readdirSync(brainDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(brainDir, d.name, '.system_generated', 'logs'))
      .filter((d) => fs.existsSync(d));
  } catch {
    return [];
  }
}

/**
 * All AGY session roots for "Watch All Sessions".
 *
 * Pixel Agents' global scanner does:
 *   for root in roots:
 *     for subdir in readdir(root):          ← expects subdirs that are sessions
 *       for file in readdir(subdir) *.jsonl: ← finds transcript.jsonl
 *
 * AGY structure: brain/<conv-id>/.system_generated/logs/transcript.jsonl
 *
 * To fit this 2-level expectation we return the `.system_generated/logs`
 * parent of each conversation — Pixel Agents then sees:
 *   root = brain/<conv-id>/.system_generated
 *   subdir = logs
 *   file = transcript.jsonl  ✓
 *
 * We enumerate existing conversations at startup; new ones are picked up
 * by getSessionDirs on workspace open.
 */
export function getAllSessionRoots(): string[] {
  const brainDir = getAgyBrainDir();
  try {
    if (!fs.existsSync(brainDir)) return [];
    return fs
      .readdirSync(brainDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(brainDir, d.name, '.system_generated'))
      .filter((d) => fs.existsSync(d));
  } catch {
    return [];
  }
}

