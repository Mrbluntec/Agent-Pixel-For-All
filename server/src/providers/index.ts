/**
 * Provider registry: re-exports all bundled providers.
 *
 * Supported providers:
 *   - claude:      Claude Code (Anthropic) — hooks + file watcher
 *   - antigravity: Antigravity (Google DeepMind) — file watcher
 *   - codex:       OpenAI Codex CLI — file watcher
 *   - opencode:    OpenCode — file watcher
 *   - chatgpt:     ChatGPT CLI / OpenAI agents — file watcher
 *
 * The adapter (VS Code extension, standalone CLI, etc.) imports from here rather
 * than reaching into each provider directory directly.
 */

import type { HookProvider } from '../../../core/src/provider.js';
import { antigravityProvider } from './hook/antigravity/antigravity.js';
import { chatgptProvider } from './hook/chatgpt/chatgpt.js';
import { claudeProvider } from './hook/claude/claude.js';
import { codexProvider } from './hook/codex/codex.js';
import { openCodeProvider } from './hook/opencode/opencode.js';

export { claudeProvider };
export { antigravityProvider };
export { codexProvider };
export { openCodeProvider };
export { chatgptProvider };
export { copyHookScript } from './hook/claude/claudeHookInstaller.js';

/** Every bundled hook provider, in registration order. The consent gate loops
 *  over this at the webviewReady handshake (one ask per provider that needs
 *  one) and `hooksConsentResponse` resolves its provider id against it. */
export const hookProviders: readonly HookProvider[] = [
  claudeProvider,
  antigravityProvider,
  codexProvider,
  openCodeProvider,
  chatgptProvider,
];

/** Resolve a wire-supplied provider id, or undefined for an unknown one —
 *  the caller writes nothing on undefined (fail-closed, like a junk choice). */
export function hookProviderById(id: unknown): HookProvider | undefined {
  return typeof id === 'string' ? hookProviders.find((p) => p.id === id) : undefined;
}
