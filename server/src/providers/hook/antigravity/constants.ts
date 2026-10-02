/** Constants for the Antigravity (AGY) provider. */

/** ID that uniquely identifies this provider across the system. */
export const AGY_PROVIDER_ID = 'antigravity' as const;

/** Human-readable name shown in the UI. */
export const AGY_DISPLAY_NAME = 'Antigravity';

/** Terminal name prefix used to identify AGY terminals. */
export const AGY_TERMINAL_NAME_PREFIX = 'Antigravity';

/** Directory where AGY writes brain/transcript files. */
export const AGY_BRAIN_SUBDIR = '.gemini/antigravity/brain';

/** Name of the hook script file. */
export const AGY_HOOK_SCRIPT_NAME = 'antigravity-hook.js';

/** Pattern for session transcript files. */
export const AGY_SESSION_FILE_PATTERN = 'transcript.jsonl';

/** Subdirectory within each conversation that holds the transcript. */
export const AGY_TRANSCRIPT_SUBPATH = '.system_generated/logs/transcript.jsonl';

/**
 * AGY transcript step types that we care about for animation.
 * AGY uses these in the `type` field of each JSONL step.
 */
export const AGY_STEP_TYPES = {
  USER_INPUT: 'USER_INPUT',
  PLANNER_RESPONSE: 'PLANNER_RESPONSE',
  GENERIC: 'GENERIC',        // Tool results
  SYSTEM: 'SYSTEM',
} as const;

/**
 * Mapping from AGY tool names to the normalized tool names that
 * Pixel Agents uses for animation classification.
 *
 * Pixel Agents classifies tools into:
 *   - readingTools:  show the "reading" animation (character looks at screen)
 *   - subagentTools: spawn a sub-agent character
 *   - others:        show the "typing" animation (character types at keyboard)
 */
export const AGY_TOOL_MAP: Readonly<Record<string, string>> = {
  // Reading / searching
  view_file:        'Read',
  grep_search:      'Grep',
  find_by_name:     'Glob',
  list_dir:         'LS',
  read_url_content: 'WebFetch',
  search_web:       'WebSearch',
  read_resource:    'ReadResource',
  list_resources:   'ListResources',
  // Writing
  write_to_file:         'Write',
  replace_file_content:  'Edit',
  generate_image:        'Draw',
  // Commands / execution
  run_command:   'Bash',
  manage_task:   'ManageTask',
  schedule:      'Schedule',
  // Sub-agents / messaging
  invoke_subagent:  'Task',
  send_message:     'Agent',
  define_subagent:  'DefineAgent',
  manage_subagents: 'ManageAgents',
  // User interaction (permission-like)
  ask_question: 'AskUserQuestion',
  // MCP
  call_mcp_tool: 'MCP',
};

/** Tools that spawn animated sub-agent characters. */
export const AGY_SUBAGENT_TOOLS = new Set(['Task', 'Agent', 'DefineAgent', 'ManageAgents']);

/** Tools that should NOT trigger permission timers. */
export const AGY_PERMISSION_EXEMPT_TOOLS = new Set([
  'Task',
  'Agent',
  'DefineAgent',
  'ManageAgents',
  'AskUserQuestion',
]);

/** Tools that show the "reading" animation. */
export const AGY_READING_TOOLS = new Set([
  'Read',
  'Grep',
  'Glob',
  'LS',
  'WebFetch',
  'WebSearch',
  'ReadResource',
  'ListResources',
]);
