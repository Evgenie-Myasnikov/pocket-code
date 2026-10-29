export function chatTitle(value:string|undefined,fallback:string){
 const text=(value||'').split('Files attached by the user')[0].split('# Files mentioned by the user:')[0].trim();
 if(!text||/^["\s:]*(?:[A-Za-z]:[\\/]|\/).*?(?:Board context|Board selection)\.txt/i.test(text))return fallback;
 return text.replace(/\s+/g,' ').slice(0,200);
}
