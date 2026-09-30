// A user-confirmed write has one atomic claim, shared by all hook invocations.
const { isDeepStrictEqual } = require('node:util');
const { openSync, closeSync } = require('node:fs');
const path = require('node:path');
let text = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { text += chunk; if (text.length > 100000) process.exit(2); });
process.stdin.on('end', () => {
  try {
    const call = JSON.parse(text), expected = process.env.POCKET_JIRA_READ_NAME;
    const args = JSON.parse(process.env.POCKET_JIRA_READ_ARGS || 'null');
    const claim = process.env.POCKET_JIRA_WRITE_CLAIM;
    if (expected !== 'transitionJiraIssue' || !claim || !path.isAbsolute(claim) || !args ||
      typeof args.cloudId !== 'string' || !/^[A-Z][A-Z0-9_]*-\d+$/i.test(args.issueIdOrKey || '') ||
      !/^\d{1,30}$/.test(args.transitionId || '') || Object.keys(args).some(k => !['cloudId', 'issueIdOrKey', 'transitionId', 'fields'].includes(k))) process.exit(2);
    if (call.tool_name === 'ToolSearch') process.exit(0);
    if (call.tool_name === 'mcp__claude_ai_Atlassian_MCP__' + expected && isDeepStrictEqual(call.tool_input, args)) {
      const fd = openSync(claim, 'wx', 0o600); closeSync(fd);
      process.exit(0);
    }
  } catch {}
  process.stderr.write('Only one exact, explicitly requested Jira transition is permitted.');
  process.exit(2);
});
