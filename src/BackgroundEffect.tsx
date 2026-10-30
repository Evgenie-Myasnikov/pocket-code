import {lazy,Suspense} from 'react';
import type {BackgroundStyle} from './background-styles';
const DarkVeil=lazy(()=>import('./vendor/react-bits/DarkVeil'));
const Aurora=lazy(()=>import('./vendor/react-bits/Aurora'));
const Iridescence=lazy(()=>import('./vendor/react-bits/Iridescence'));
const SoftAurora=lazy(()=>import('./vendor/react-bits/SoftAurora'));
const Grainient=lazy(()=>import('./vendor/react-bits/Grainient'));
const LightPillar=lazy(()=>import('./vendor/react-bits/LightPillar'));
const Galaxy=lazy(()=>import('./vendor/react-bits/Galaxy'));
const LiquidChrome=lazy(()=>import('./vendor/react-bits/LiquidChrome'));
const Plasma=lazy(()=>import('./vendor/react-bits/Plasma'));
const FloatingLines=lazy(()=>import('./vendor/react-bits/FloatingLines'));

export function BackgroundEffect({kind,color,speed,paused,light}:{kind:BackgroundStyle;color:string;speed:number;paused:boolean;light:boolean}){
 const motion=paused?0:speed/100,common={paused,lightMode:light,dpr:.75,intro:false};
 const colors=color?[color,color]:undefined;
 const content=(()=>{switch(kind){
 case 'aurora':return <Aurora {...common} speed={motion} colorStops={colors} mouseInteraction={false}/>;
 case 'iridescence':return <Iridescence color={color||undefined} speed={motion} paused={paused} saturation={color?.3:1} brightness={1.1} resolution={.5} mouseReact={false} clickSwirl={false}/>;
 case 'softAurora':return <SoftAurora speed={motion} colorSpeed={motion*.4} color1={color||undefined} color2={color||undefined} intro={false} enableMouseInteraction={false} clickPulse={false} lightMode={light}/>;
 case 'grainient':return <Grainient lightMode={light} dpr={.75} intro={false} colors={colors||['#4920b4','#15102c','#266eaa']} speed={motion} grainAnimated={false} grainAmount={.03} interactive={false} clickSwirl={false}/>;
 case 'lightPillar':return <LightPillar {...common} topColor={color||undefined} bottomColor={color||undefined} rotationSpeed={motion} interactive={false} clickPulse={false} quality="low" detail={3} noiseIntensity={.05} mixBlendMode="normal"/>;
 case 'galaxy':return <Galaxy lightMode={light} dpr={.75} intro={false} starColors={colors} speed={motion} disableAnimation={paused} mouseInteraction={false} mouseRepulsion={false} clickWarp={false} density={.65} layers={3}/>;
 case 'liquidChrome':return <LiquidChrome color={color||'#7d59cf'} speed={motion} interactive={false} rippleStrength={0} tilt={0} intro={false} lightMode={light} maxDevicePixelRatio={.75} detail={3}/>;
 case 'plasma':return <Plasma {...common} color={color||'#855cff'} speed={motion} mouseInteractive={false} quality={.5} grain={0}/>;
 case 'floatingLines':return <FloatingLines lightMode={light} dpr={.75} intro={false} linesGradient={colors} animationSpeed={motion} interactive={false} parallax={false} clickSwirl={false} lineCount={8} lineWidth={2.5} brightness={2.2} glow={2} depthOfField={.15} mixBlendMode="normal"/>;
 default:return <DarkVeil {...common} speed={motion} color={color||undefined} quality={.25} mouseInteraction={false} grain={0} brightness={1.1}/>;
 }})();
 return <Suspense fallback={null}>{content}</Suspense>;
}
