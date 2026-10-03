export function connectionKind(address:string){
  try{const url=new URL(address),host=url.hostname;if(/^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)||host.endsWith('.ts.net'))return 'Tailscale';if(url.protocol==='http:'||/^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host))return 'Local';return 'Internet';}catch{return 'Unknown';}
}
