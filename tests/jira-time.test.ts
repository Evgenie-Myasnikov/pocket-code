import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateTransitionFields} from '../server/jira-workflow-actions';
import {validEstimate} from '../src/jira-time';
const transition={id:'1',name:'Start',to:{name:'In Progress'},fields:{timetracking:{name:'Time tracking',required:true,schema:{type:'timetracking',system:'timetracking'}}}};
test('required estimates accept Jira durations and reject missing, zero and malformed input before mutation',()=>{
 for(const estimate of ['2h','1d 30m','0.5h']){assert.equal(validEstimate(estimate),true);assert.doesNotThrow(()=>validateTransitionFields(transition,{timetracking:{originalEstimate:estimate}}));}
 for(const estimate of ['', '0m','-1h','2','tomorrow'])assert.equal(validEstimate(estimate),false);
 assert.throws(()=>validateTransitionFields(transition),/Required Jira field/);
 for(const value of [{},{originalEstimate:'0m'},{originalEstimate:'2h',timeSpent:'1h'},'2h'])assert.throws(()=>validateTransitionFields(transition,{timetracking:value}),/Enter a time estimate/);
});
