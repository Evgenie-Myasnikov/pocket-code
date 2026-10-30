import {lazy,Suspense} from 'react';
import type {BackgroundStyle} from './background-styles';
const DarkVeil=lazy(()=>import('./vendor/react-bits/DarkVeil'));
const Silk=lazy(()=>import('./vendor/react-bits/Silk'));
const GradientBlinds=lazy(()=>import('./vendor/react-bits/GradientBlinds'));
const PlasmaWave=lazy(()=>import('./vendor/react-bits/PlasmaWave'));
const GhostFibers=lazy(()=>import('./vendor/react-bits/GhostFibers'));
const FluxLines=lazy(()=>import('./vendor/react-bits/FluxLines'));
const Lightfall=lazy(()=>import('./vendor/react-bits/Lightfall'));
const MoltenMetal=lazy(()=>import('./vendor/react-bits/MoltenMetal'));
const PrismaticBurst=lazy(()=>import('./vendor/react-bits/PrismaticBurst'));
const Aurora=lazy(()=>import('./vendor/react-bits/Aurora'));
const Iridescence=lazy(()=>import('./vendor/react-bits/Iridescence'));

export function BackgroundEffect({kind,color,speed,paused,light}:{kind:BackgroundStyle;color:string;speed:number;paused:boolean;light:boolean}){
 const common={speed:speed/100,paused,lightMode:light,dpr:.75,intro:false};
 const colors=color?[color]:undefined;
 const content=(()=>{switch(kind){
 case 'silk':return <Silk {...common} color={color||undefined} mouseInteraction={false} clickRipple={false}/>;
 case 'gradientBlinds':return <GradientBlinds {...common} gradientColors={colors} gradientSpeed={speed/100} hoverTilt={0} clickEffect="none" noise={0}/>;
 case 'plasmaWave':return <PlasmaWave {...common} colors={colors} quality={.5} mouseInteraction={false}/>;
 case 'ghostFibers':return <GhostFibers {...common} glowColor={color||undefined} mouseInteraction={false} pulseOnClick={false}/>;
 case 'fluxLines':return <FluxLines {...common} colors={colors} mouseInteraction={false} clickSwirl={false}/>;
 case 'lightfall':return <Lightfall {...common} colors={colors} mouseInteraction={false} holdToWarp={false}/>;
 case 'moltenMetal':return <MoltenMetal {...common} colors={colors} mouseInteraction={false} flareOnClick={false}/>;
 case 'prismaticBurst':return <PrismaticBurst {...common} colors={colors} quality="low" mouseInteraction={false} clickBurst={false}/>;
 case 'aurora':return <Aurora {...common} colorStops={colors} mouseInteraction={false}/>;
 case 'iridescence':return <Iridescence color={color||undefined} speed={speed/100} paused={paused} resolution={.5} mouseReact={false} clickSwirl={false}/>;
 default:return <DarkVeil {...common} color={color||undefined} quality={.25} mouseInteraction={false} grain={0} brightness={1.1}/>;
 }})();
 return <Suspense fallback={null}>{content}</Suspense>;
}
