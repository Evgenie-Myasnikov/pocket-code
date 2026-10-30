export const backgroundStyles=[
 {id:'veil',ru:'DarkVeil',en:'DarkVeil'},
 {id:'aurora',ru:'Aurora',en:'Aurora'},
 {id:'iridescence',ru:'Iridescence',en:'Iridescence'},
 {id:'softAurora',ru:'SoftAurora',en:'SoftAurora'},
 {id:'grainient',ru:'Grainient',en:'Grainient'},
 {id:'lightPillar',ru:'LightPillar',en:'LightPillar'},
 {id:'galaxy',ru:'Galaxy',en:'Galaxy'},
 {id:'liquidChrome',ru:'LiquidChrome',en:'LiquidChrome'},
 {id:'plasma',ru:'Plasma',en:'Plasma'},
 {id:'floatingLines',ru:'FloatingLines',en:'FloatingLines'},
] as const;
export type BackgroundStyle=typeof backgroundStyles[number]['id'];
export function backgroundStyle(value:unknown):BackgroundStyle{return backgroundStyles.find(item=>item.id===value)?.id||'veil';}
export const backgroundPreview=(id:BackgroundStyle)=>new URL(`./assets/backgrounds/${id}.png`,import.meta.url).href;
