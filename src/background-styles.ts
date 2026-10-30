export const backgroundStyles=[
 {id:'veil',ru:'DarkVeil',en:'DarkVeil'},
 {id:'silk',ru:'Silk',en:'Silk'},
 {id:'gradientBlinds',ru:'GradientBlinds',en:'GradientBlinds'},
 {id:'plasmaWave',ru:'PlasmaWave',en:'PlasmaWave'},
 {id:'ghostFibers',ru:'GhostFibers',en:'GhostFibers'},
 {id:'fluxLines',ru:'FluxLines',en:'FluxLines'},
 {id:'lightfall',ru:'Lightfall',en:'Lightfall'},
 {id:'moltenMetal',ru:'MoltenMetal',en:'MoltenMetal'},
 {id:'prismaticBurst',ru:'PrismaticBurst',en:'PrismaticBurst'},
 {id:'aurora',ru:'Aurora',en:'Aurora'},
 {id:'iridescence',ru:'Iridescence',en:'Iridescence'},
] as const;
export type BackgroundStyle=typeof backgroundStyles[number]['id'];
export function backgroundStyle(value:unknown):BackgroundStyle{return backgroundStyles.find(item=>item.id===value)?.id||'veil';}
export const backgroundPreview=(id:BackgroundStyle)=>new URL(`./assets/backgrounds/${id}.png`,import.meta.url).href;
