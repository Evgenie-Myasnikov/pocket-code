// Fail closed: this subprocess may search for a tool or perform exactly one prescribed read.
const { isDeepStrictEqual } = require('node:util');
let text = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { text += chunk; if (text.length > 100000) process.exit(2); });
process.stdin.on('end', () => {
  try {
    const call = JSON.parse(text);
    const expected = process.env.POCKET_JIRA_READ_NAME;
    const args = JSON.parse(process.env.POCKET_JIRA_READ_ARGS || 'null');
    if (!['getAccessibleAtlassianResources', 'searchJiraIssuesUsingJql', 'getJiraIssue', 'executeRead'].includes(expected)) process.exit(2);
    if (expected === 'executeRead' && args?.name !== 'listJiraIssueTransitions') process.exit(2);
    const allowed = call.tool_name === 'ToolSearch' || (call.tool_name === 'mcp__claude_ai_Atlassian_MCP__' + expected && isDeepStrictEqual(call.tool_input, args));
    if (allowed) process.exit(0);
  } catch {}
  process.stderr.write('Only the prescribed Jira read is permitted.');
  process.exit(2);
});
