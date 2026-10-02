export const OPENCODE_PROVIDER_ID = 'opencode';
export const OPENCODE_DISPLAY_NAME = 'OpenCode';
export const OPENCODE_STORAGE_SUBDIR = '.local/share/opencode';
export const OPENCODE_SESSION_FILE_PATTERN = '*.json';
export const OPENCODE_TERMINAL_NAME_PREFIX = 'opencode';

export const OPENCODE_READING_TOOLS: ReadonlySet<string> = new Set([
  'read',
  'read_file',
  'glob',
  'grep',
  'list',
]);
export const OPENCODE_PERMISSION_EXEMPT_TOOLS: ReadonlySet<string> = new Set([
  'read',
  'read_file',
  'glob',
  'grep',
  'list',
]);
export const OPENCODE_SUBAGENT_TOOLS: ReadonlySet<string> = new Set([
  'agent',
  'subagent',
]);
