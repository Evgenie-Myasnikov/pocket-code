/** Wait for observable async work, rather than assuming one timer tick finishes I/O. */
export async function waitFor(predicate:()=>boolean, timeoutMs=3000) {
  const end=Date.now()+timeoutMs;
  while(!predicate()) {
    if(Date.now()>=end) throw new Error('Timed out waiting for the expected state');
    await new Promise(resolve=>setTimeout(resolve,5));
  }
}
