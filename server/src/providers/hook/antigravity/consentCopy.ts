/**
 * Consent copy for the Antigravity (AGY) hook provider.
 *
 * The consent gate shows these strings verbatim — every factual claim here
 * must be accurate. Changes to what we install or what data moves must be
 * reflected here first.
 */

export const CONSENT_INSTALL_HEADLINE =
  'Allow Pixel Agents to watch your Antigravity sessions?';

export const CONSENT_DISCLOSURE = `
Pixel Agents reads the transcript files that Antigravity (AGY) already writes
to \`~/.gemini/antigravity/brain/<session-id>/.system_generated/logs/transcript.jsonl\`.
No data leaves your machine — the session transcripts are read locally.

What Pixel Agents does with them:
- Detects when a new AGY conversation starts and creates a character in the office.
- Reads tool call names (not their outputs) to animate the character: typing, reading, running commands.
- Detects when the session ends and marks the character as idle.

What Pixel Agents does NOT do:
- It does not install any hook scripts into the AGY configuration.
- It does not send any transcript data to a remote server.
- It does not modify any AGY settings files.

AGY uses a file-watcher approach (no hook scripts), so no changes are made to
\`~/.gemini/antigravity/\` beyond reading the transcript files that AGY already writes.

To stop watching: disable Antigravity in Pixel Agents Settings → Hooks.
`.trim();
