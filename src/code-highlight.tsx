import {useEffect,useState,type ReactNode} from 'react';
import type {HighlighterCore,ThemedToken} from 'shiki/core';
import './code-highlight.css';

/**
 * Syntax highlighting with Shiki (MIT): the TextMate grammars and the Dark+ / Light+ themes of VS Code. Grammars load
 * on demand, one chunk per language, with Shiki's JavaScript regex engine (no WebAssembly). Tokens are drawn as
 * React spans, so file text never becomes HTML. Large text stays plain.
 */
const MAX_CHARS=300_000,MAX_LINES=8_000;
const byExtension:Record<string,string>={
  ts:'typescript',mts:'typescript',cts:'typescript',tsx:'tsx',js:'javascript',mjs:'javascript',cjs:'javascript',jsx:'jsx',json:'json',jsonc:'jsonc',
  md:'markdown',markdown:'markdown',py:'python',pyw:'python',cs:'csharp',csx:'csharp',cpp:'cpp',cc:'cpp',cxx:'cpp',hpp:'cpp',hh:'cpp',hxx:'cpp',h:'cpp',c:'c',inl:'cpp',
  rs:'rust',go:'go',java:'java',kt:'kotlin',kts:'kotlin',swift:'swift',rb:'ruby',php:'php',lua:'lua',dart:'dart',scala:'scala',
  ps1:'powershell',psm1:'powershell',psd1:'powershell',sh:'shellscript',bash:'shellscript',zsh:'shellscript',bat:'bat',cmd:'bat',
  yaml:'yaml',yml:'yaml',toml:'toml',ini:'ini',xml:'xml',csproj:'xml',props:'xml',targets:'xml',xaml:'xml',axaml:'xml',svg:'xml',plist:'xml',
  html:'html',htm:'html',css:'css',scss:'scss',less:'less',vue:'vue',svelte:'svelte',sql:'sql',graphql:'graphql',gql:'graphql',
  hlsl:'hlsl',hlsli:'hlsl',fx:'hlsl',fxh:'hlsl',usf:'hlsl',ush:'hlsl',compute:'hlsl',
  glsl:'glsl',vert:'glsl',frag:'glsl',geom:'glsl',comp:'glsl',tesc:'glsl',tese:'glsl',vs:'glsl',fs:'glsl',rgen:'glsl',rchit:'glsl',rmiss:'glsl',
  wgsl:'wgsl',shader:'shaderlab',cginc:'hlsl',metal:'cpp',
  gradle:'groovy',groovy:'groovy',cmake:'cmake',diff:'diff',patch:'diff',dockerfile:'dockerfile',r:'r',m:'objective-c',mm:'objective-cpp',
  fsx:'fsharp',vb:'vb',zig:'zig',nim:'nim',ex:'elixir',exs:'elixir',erl:'erlang',hs:'haskell',ml:'ocaml',clj:'clojure',
};
const byName:Record<string,string>={dockerfile:'dockerfile',makefile:'make','cmakelists.txt':'cmake','.gitignore':'shellscript','.editorconfig':'ini'};
/** Fence names people write that Shiki knows under another id. */
const aliases:Record<string,string>={hlsl:'hlsl',glsl:'glsl',shader:'shaderlab',cs:'csharp','c#':'csharp',sh:'shellscript',bash:'shellscript',shell:'shellscript',ps:'powershell',ps1:'powershell',pwsh:'powershell',py:'python',ts:'typescript',js:'javascript',yml:'yaml',md:'markdown',cpp:'cpp','c++':'cpp',rs:'rust',kt:'kotlin',rb:'ruby',console:'shellscript',text:'',txt:'',plaintext:''};

export function languageForFile(path:string){
  const name=path.split(/[\\/]/).pop()?.toLowerCase()||'';
  if(byName[name])return byName[name];
  const dot=name.lastIndexOf('.');return dot>0?byExtension[name.slice(dot+1)]||'':'';
}
export function languageForFence(info:string|undefined){
  const id=(info||'').trim().toLowerCase().replace(/^language-/,'');
  return id in aliases?aliases[id]:id;
}

let highlighter:Promise<HighlighterCore>|undefined;
const loaded=new Map<string,Promise<boolean>>();
async function ready(lang:string){
  highlighter??=(async()=>{
    const [{createHighlighterCore},{createJavaScriptRegexEngine}]=await Promise.all([import('shiki/core'),import('shiki/engine/javascript')]);
    return createHighlighterCore({themes:[import('@shikijs/themes/dark-plus'),import('@shikijs/themes/light-plus')],langs:[],engine:createJavaScriptRegexEngine()});
  })();
  const core=await highlighter;
  if(!loaded.has(lang))loaded.set(lang,(async()=>{
    const {bundledLanguages}=await import('shiki/langs');
    const load=(bundledLanguages as Record<string,(()=>Promise<unknown>)|undefined>)[lang];
    if(!load)return false;
    await core.loadLanguage(load as never);return true;
  })().catch(()=>false));
  return await loaded.get(lang)!?core:null;
}

/** Tokens of one text, or null while loading, for a language Shiki does not know, or for text too large to colour. */
export function useHighlight(text:string,lang:string){
  const [tokens,setTokens]=useState<{key:string;lines:ThemedToken[][]}|null>(null);
  const key=lang+'\u0000'+text.length+'\u0000'+text.slice(0,64)+text.slice(-64);
  useEffect(()=>{
    if(!lang||text.length>MAX_CHARS||text.split('\n',MAX_LINES+1).length>MAX_LINES){setTokens(null);return;}
    let live=true;
    void ready(lang).then(core=>{
      if(!live||!core)return;
      const result=core.codeToTokens(text,{lang,themes:{dark:'dark-plus',light:'light-plus'},defaultColor:false});
      setTokens({key,lines:result.tokens});
    }).catch(()=>{});
    return()=>{live=false;};
  },[key]);
  return tokens?.key===key?tokens.lines:null;
}

/** The highlighted lines of a text; the plain text until the grammar has loaded or when the language is unknown. */
export function HighlightedCode({text,lang,fallback}:{text:string;lang:string;fallback?:ReactNode}){
  const lines=useHighlight(text,lang);
  if(!lines)return <>{fallback??text}</>;
  return <>{lines.map((line,index)=><span key={index} className="code-line">{line.map((token,i)=><span key={i} style={token.htmlStyle as React.CSSProperties|undefined}>{token.content}</span>)}{index<lines.length-1?'\n':''}</span>)}</>;
}
