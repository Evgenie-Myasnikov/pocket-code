import test from 'node:test';
import assert from 'node:assert/strict';
import {jiraIssuesJql} from '../server/jira';
test('Jira native filters combine on the server while retaining current-user assignment',()=>{
 assert.equal(jiraIssuesJql({statusCategory:'indeterminate',status:'PR Review',project:'DEMO',type:'Custom task',search:'DEMO-42'}),'assignee = currentUser() AND key = "DEMO-42" AND issuetype = "Custom task" AND statusCategory = "In Progress" AND status = "PR Review" AND project = "DEMO" ORDER BY updated DESC');
 assert.match(jiraIssuesJql({statusCategory:'new'}),/statusCategory = "To Do"/);
 assert.match(jiraIssuesJql({statusCategory:'done'}),/statusCategory = "Done"/);
});
test('native filter values cannot escape JQL strings or invent status categories',()=>{
 assert.throws(()=>jiraIssuesJql({statusCategory:'review'}));
 assert.throws(()=>jiraIssuesJql({status:'x\nOR assignee IS EMPTY'}));
 assert.equal(jiraIssuesJql({project:'x" OR assignee IS EMPTY',status:'QA\\review'}),'assignee = currentUser() AND status = "QA\\\\review" AND project = "x\\" OR assignee IS EMPTY" ORDER BY updated DESC');
});
