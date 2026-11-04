import {lazy,Suspense} from 'react';
import type {BackgroundStyle} from './background-styles';
const DarkVeil=lazy(()=>import('./vendor/react-bits/DarkVeil'));
const Iridescence=lazy(()=>import('./vendor/react-bits/Iridescence'));
const SoftAurora=lazy(()=>import('./vendor/react-bits/SoftAurora'));
const Grainient=lazy(()=>import('./vendor/react-bits/Grainient'));
const LightPillar=lazy(()=>import('./vendor/react-bits/LightPillar'));
const Galaxy=lazy(()=>import('./vendor/react-bits/Galaxy'));
const Plasma=lazy(()=>import('./vendor/react-bits/Plasma'));
const Prism=lazy(()=>import('./vendor/react-bits/Prism'));
const LightRays=lazy(()=>import('./vendor/react-bits/LightRays'));
const GradientWaves=lazy(()=>import('./vendor/react-bits/GradientWaves'));
const SideRays=lazy(()=>import('./vendor/react-bits/SideRays'));
const RippleGrid=lazy(()=>import('./vendor/react-bits/RippleGrid'));
const PixelSnow=lazy(()=>import('./vendor/react-bits/PixelSnow'));
const Topography=lazy(()=>import('./vendor/react-bits/Topography'));
const Dither=lazy(()=>import('./vendor/react-bits/Dither'));
const Orb=lazy(()=>import('./vendor/react-bits/Orb'));
const Beams=lazy(()=>import('./vendor/react-bits/Beams'));

export function BackgroundEffect({kind,color,speed,paused,light}:{kind:BackgroundStyle;color:string;speed:number;paused:boolean;light:boolean}){
 const motion=paused?0:speed/100,common={paused,lightMode:light,dpr:.75,intro:false};
 const colors=color?[color,color]:undefined;
 const content=(()=>{switch(kind){
 case 'iridescence':return <Iridescence color={color||undefined} speed={motion} paused={paused} saturation={color?.3:1} brightness={1.1} resolution={.5} mouseReact={false} clickSwirl={false}/>;
 case 'softAurora':return <SoftAurora speed={motion} colorSpeed={motion*.4} color1={color||undefined} color2={color||undefined} intro={false} enableMouseInteraction={false} clickPulse={false} lightMode={light}/>;
 case 'grainient':return <Grainient lightMode={light} dpr={.75} intro={false} colors={colors||['#4920b4','#15102c','#266eaa']} speed={motion} grainAnimated={false} grainAmount={.03} interactive={false} clickSwirl={false}/>;
 case 'lightPillar':return <LightPillar {...common} topColor={color||undefined} bottomColor={color||undefined} rotationSpeed={motion} interactive={false} clickPulse={false} quality="low" detail={3} noiseIntensity={.05} mixBlendMode="normal"/>;
 case 'galaxy':return <Galaxy lightMode={light} dpr={.75} intro={false} starColors={colors} speed={motion} disableAnimation={paused} mouseInteraction={false} mouseRepulsion={false} clickWarp={false} density={.65} layers={3}/>;
 case 'plasma':return <Plasma {...common} color={color||'#855cff'} speed={motion} mouseInteractive={false} quality={.5} grain={0}/>;
 case 'prism':return <Prism colors={colors} timeScale={motion} resolution={.5} dpr={.75} intro={false} interactive={false} noise={0} lightMode={light}/>;
 case 'lightRays':return <LightRays raysColor={color||undefined} raysSpeed={motion} maxDevicePixelRatio={.75} intro={false} followMouse={false} cursorShadow={false} clickPulse={false} pulsating={false} noiseAmount={0} lightMode={light}/>;
 case 'gradientWaves':return <GradientWaves {...common} waveColor={color||undefined} horizonColor={color||undefined} speed={motion} quality="low" grain={0} mouseInteraction={false} swellOnClick={false}/>;
 case 'sideRays':return <SideRays rayColor1={color||undefined} rayColor2={color||undefined} speed={motion} maxDevicePixelRatio={.75} intro={false} followMouse={false} lightMode={light}/>;
 case 'rippleGrid':return <RippleGrid {...common} color={color||undefined} rippleSpeed={motion} mouseInteraction={false} clickRipple={false} autoRipple="center" cellSize={36}/>;
 case 'pixelSnow':return <PixelSnow {...common} color={color||undefined} speed={motion} density={.12} accumulate={false} mouseInteraction={false}/>;
 case 'topography':return <Topography {...common} color={color||undefined} speed={motion*.5} morph={motion*.25} detail={.2} glow={0} depthOfField={0} mouseInteraction={false} parallax={0} clickEffect="none" markers="none" glitch={0}/>;
 case 'dither':return <Dither waveColor={color||undefined} waveSpeed={motion*.05} disableAnimation={paused} enableMouseInteraction={false} clickRipple={false} intro={false} dpr={.75} backgroundColor="transparent"/>;
 case 'orb':return <Orb colors={color?[color,color,color]:undefined} speed={motion} paused={paused} dpr={.75} intro={false} followCursor={false} rotateOnHover={false} hoverIntensity={0} forceHoverState={false} clickPulse={false} backgroundColor="transparent"/>;
 case 'beams':return <Beams {...common} color={color||undefined} speed={motion} mouseInteraction={false} quality={.5}/>;
 default:return <DarkVeil {...common} speed={motion} color={color||undefined} quality={.25} mouseInteraction={false} grain={0} brightness={1.1}/>;
 }})();
 return <Suspense fallback={null}>{content}</Suspense>;
}
