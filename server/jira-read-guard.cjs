// Fail closed: this subprocess may search for a tool or perform exactly one prescribed read.
const { isDeepStrictEqual } = require('node:util');
let text = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { text += chunk; if (text.length > 100000) process.exit(2); });
process.stdin.on('end', () => {
  try {
    const call = JSON.parse(text);
    const expected = process.env.POCKET_JIRA_READ_NAME;
    if (!['getAccessibleAtlassianResources', 'searchJiraIssuesUsingJql', 'getJiraIssue'].includes(expected)) process.exit(2);
    const allowed = call.tool_name === 'ToolSearch' || (call.tool_name === 'mcp__claude_ai_Atlassian_MCP__' + expected && isDeepStrictEqual(call.tool_input, JSON.parse(process.env.POCKET_JIRA_READ_ARGS)));
    if (allowed) process.exit(0);
  } catch {}
  process.stderr.write('Only the prescribed Jira read is permitted.');
  process.exit(2);
});
