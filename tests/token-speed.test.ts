import {test} from 'node:test';
import assert from 'node:assert/strict';
import {averageSpeed,recordTokens,SPEED_UPDATES,type TokenSpeed} from '../src/token-speed.js';

test('the speed is the average of the speeds of the updates that added tokens',()=>{
 const state:TokenSpeed={rates:[]};
 recordTokens(state,'job',0,0);assert.equal(averageSpeed(state),undefined);
 recordTokens(state,'job',10,1000);   // 10 tokens in 1 s
 recordTokens(state,'job',50,2000);   // 40 tokens in 1 s
 assert.equal(averageSpeed(state),25);
});

test('an update without new tokens, a pause of several seconds and a new turn add no speed',()=>{
 const state:TokenSpeed={rates:[]};
 recordTokens(state,'one',10,0);recordTokens(state,'one',10,500);assert.equal(averageSpeed(state),undefined);
 recordTokens(state,'one',30,20000);assert.equal(averageSpeed(state),undefined);      // measured across a 19.5 s gap: not an update
 recordTokens(state,'two',5,21000);assert.equal(averageSpeed(state),undefined);       // a new turn starts from its own count
 recordTokens(state,'two',25,22000);assert.equal(averageSpeed(state),20);
});

test('only the last 100 updates count',()=>{
 const state:TokenSpeed={rates:[]};let tokens=0,at=0;
 recordTokens(state,'job',tokens,at);
 for(let i=0;i<SPEED_UPDATES;i++){tokens+=10;at+=1000;recordTokens(state,'job',tokens,at);}   // 100 updates of 10 tok/s
 assert.equal(averageSpeed(state),10);
 for(let i=0;i<SPEED_UPDATES;i++){tokens+=50;at+=1000;recordTokens(state,'job',tokens,at);}   // then 100 updates of 50 tok/s
 assert.equal(state.rates.length,SPEED_UPDATES);assert.equal(averageSpeed(state),50);
});
