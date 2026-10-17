// "Viewed" marks in Review: path → file fingerprint, one entry per PC, repository and comparison.
const PREFIX='pocket-code-review-viewed:';
/** The key never stores the PC address or repository path, only a short hash of them. */
function key(scope:string){let hash=5381;for(let i=0;i<scope.length;i++)hash=(hash*33+scope.charCodeAt(i))>>>0;return PREFIX+hash.toString(36);}
export function readViewed(scope:string):Record<string,string>{
  try{const value=JSON.parse(localStorage.getItem(key(scope))||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([,version])=>typeof version==='string')) as Record<string,string>:{};}catch{return {};}
}
export function writeViewed(scope:string,value:Record<string,string>){
  try{const entries=Object.entries(value).slice(-500);if(entries.length)localStorage.setItem(key(scope),JSON.stringify(Object.fromEntries(entries)));else localStorage.removeItem(key(scope));}catch{/* Marks are a convenience. */}
}
/** Disconnecting or forgetting a PC removes its Review marks with the rest of its local data. */
export function clearReviewViewed(){try{for(const name of Object.keys(localStorage))if(name.startsWith(PREFIX))localStorage.removeItem(name);}catch{/* Storage can be unavailable. */}}
