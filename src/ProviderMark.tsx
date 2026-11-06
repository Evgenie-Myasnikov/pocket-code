/** Monochrome provider marks drawn in currentColor (a token), sized by the surrounding font: one shape per provider instead of the shared Unicode glyphs. */
export function ProviderMark({provider}:{provider:string}){
  const common={width:'1em',height:'1em',viewBox:'0 0 24 24','aria-hidden':true,focusable:false,fill:'none',stroke:'currentColor',strokeWidth:1.75,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  if(provider==='codex')return <svg {...common} className="provider-mark provider-mark-codex"><path d="M12 3.5 19.4 7.75v8.5L12 20.5l-7.4-4.25v-8.5Z"/><path d="m8.75 10 2.5 2-2.5 2M12.75 14.5h3"/></svg>;
  if(provider==='copilot')return <svg {...common} className="provider-mark provider-mark-copilot"><path d="M4.5 12.5c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5v2.75c0 1.8-3.4 3.25-7.5 3.25s-7.5-1.45-7.5-3.25Z"/><path d="M9.25 12.25v1.5M14.75 12.25v1.5"/></svg>;
  if(provider==='custom')return <svg {...common} className="provider-mark provider-mark-custom"><circle cx="8" cy="15.5" r="3.75"/><path d="m10.75 12.75 7.75-7.75M15.5 8l2.25 2.25M13.25 10.25l1.75 1.75"/></svg>;
  return <svg {...common} className="provider-mark provider-mark-claude"><path d="M12 4v16M4 12h16M6.35 6.35l11.3 11.3M17.65 6.35 6.35 17.65"/></svg>;
}
