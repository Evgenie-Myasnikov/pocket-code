/**
 * Jira sign-in stays hidden until issues have a place to appear (board cards fed by Jira).
 * The connection code is kept; a developer can opt in on one device with
 * localStorage['pocket-code-labs-jira']='1'.
 */
export function jiraEnabled(){try{return localStorage.getItem('pocket-code-labs-jira')==='1';}catch{return false;}}
