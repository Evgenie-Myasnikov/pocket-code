/**
 * The speed shown under the message field: the average of the last 100 updates of the chat's generated tokens.
 * Each update that added tokens gives one speed (tokens added over the time since the previous update); a pause
 * of several seconds (the model thinking, a tool running) is not an update to measure across.
 */
export const SPEED_UPDATES=100;
export const SPEED_GAP_MS=5000;

export type TokenSpeed={rates:number[];last?:{at:number;tokens:number;job:string}};

/** Notes that the chat has `tokens` generated tokens in turn `job` at time `at` (ms); returns the state. */
export function recordTokens(state:TokenSpeed,job:string,tokens:number,at:number):TokenSpeed{
  const last=state.last;
  if(last&&last.job===job&&tokens>last.tokens){
    const elapsed=at-last.at;
    if(elapsed>=1&&elapsed<=SPEED_GAP_MS){
      state.rates.push((tokens-last.tokens)/elapsed*1000);
      if(state.rates.length>SPEED_UPDATES)state.rates.splice(0,state.rates.length-SPEED_UPDATES);
    }
  }
  if(!last||last.job!==job||tokens!==last.tokens)state.last={at,tokens,job};
  return state;
}

/** The average speed in tokens per second, or undefined before two updates have been seen. */
export function averageSpeed(state:TokenSpeed):number|undefined{
  return state.rates.length?state.rates.reduce((sum,rate)=>sum+rate,0)/state.rates.length:undefined;
}
