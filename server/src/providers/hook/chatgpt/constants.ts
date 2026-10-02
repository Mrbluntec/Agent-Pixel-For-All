export const CHATGPT_PROVIDER_ID = 'chatgpt';
export const CHATGPT_DISPLAY_NAME = 'ChatGPT';
export const CHATGPT_SESSION_FILE_PATTERN = '*.json';
export const CHATGPT_TERMINAL_NAME_PREFIX = 'chatgpt';
export const CHATGPT_HISTORY_SUBDIRS = ['.chatgpt-cli/session-history', '.chatgpt-cli/history', '.openai/history'];

export const CHATGPT_READING_TOOLS: ReadonlySet<string> = new Set(['python', 'browser', 'retrieval']);
export const CHATGPT_PERMISSION_EXEMPT_TOOLS: ReadonlySet<string> = new Set(['python', 'retrieval']);
export const CHATGPT_SUBAGENT_TOOLS: ReadonlySet<string> = new Set(['spawn_agent', 'agent']);
