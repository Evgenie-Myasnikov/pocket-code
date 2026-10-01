import type {JiraTransitionField} from '../server/jira';
export const isTimeTracking=(field:JiraTransitionField)=>field.schema.type==='timetracking'||field.schema.system==='timetracking';
// Explicit units avoid dependence on the site's default time unit.
export function validEstimate(value:unknown):value is string{
 return typeof value==='string'&&value.length<=100&&/^\s*(?:\d+(?:\.\d+)?\s*[wdhm]\s*)+$/i.test(value)&&((value.match(/\d+(?:\.\d+)?/g)||[]).some(n=>Number(n)>0));
}
