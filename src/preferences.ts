export function preferences() {
  try {const value=JSON.parse(localStorage.getItem('pocket-code-chat-preferences')||'{}');return {model:['','sonnet','opus','haiku'].includes(value.model)?value.model:'',mode:['default','plan'].includes(value.mode)?value.mode:'default',budget:typeof value.budget==='number'&&Number.isFinite(value.budget)&&value.budget>=0.1&&value.budget<=100?value.budget:5};}
  catch{return {model:'',mode:'default',budget:5};}
}
export function preferredRoot(host:string,roots:string[]){try{const root=JSON.parse(localStorage.getItem('pocket-code-projects')||'{}')[host];return roots.includes(root)?root:roots[0];}catch{return roots[0];}}
