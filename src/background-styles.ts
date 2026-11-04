export const backgroundStyles=[
 {id:'veil',ru:'DarkVeil',en:'DarkVeil'},
 {id:'iridescence',ru:'Iridescence',en:'Iridescence'},
 {id:'softAurora',ru:'SoftAurora',en:'SoftAurora'},
 {id:'grainient',ru:'Grainient',en:'Grainient'},
 {id:'lightPillar',ru:'LightPillar',en:'LightPillar'},
 {id:'galaxy',ru:'Galaxy',en:'Galaxy'},
 {id:'plasma',ru:'Plasma',en:'Plasma'},
 {id:'prism',ru:'Prism',en:'Prism'},
 {id:'lightRays',ru:'LightRays',en:'LightRays'},
 {id:'gradientWaves',ru:'GradientWaves',en:'GradientWaves'},
 {id:'sideRays',ru:'SideRays',en:'SideRays'},
 {id:'rippleGrid',ru:'RippleGrid',en:'RippleGrid'},
 {id:'pixelSnow',ru:'PixelSnow',en:'PixelSnow'},
 {id:'topography',ru:'Topography',en:'Topography'},
 {id:'dither',ru:'Dither',en:'Dither'},
 {id:'orb',ru:'Orb',en:'Orb'},
 {id:'beams',ru:'Beams',en:'Beams'},
] as const;
export type BackgroundStyle=typeof backgroundStyles[number]['id'];
export function backgroundStyle(value:unknown):BackgroundStyle{return backgroundStyles.find(item=>item.id===value)?.id||'veil';}
export const backgroundPreview=(id:BackgroundStyle)=>new URL(`./assets/backgrounds/${id}.png`,import.meta.url).href;
