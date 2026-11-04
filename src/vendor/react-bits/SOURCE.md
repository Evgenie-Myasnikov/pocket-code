# React Bits backgrounds

Original TypeScript/CSS components are pinned to upstream commit `e12c22192ac7b4b452c5e2feb9b586d74765d696`:

- [DarkVeil](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/DarkVeil)
- [Iridescence](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Iridescence)
- [SoftAurora](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/SoftAurora)
- [Grainient](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Grainient)
- [LightPillar](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/LightPillar)
- [Galaxy](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Galaxy)
- [Plasma](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Plasma)
- [Prism](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Prism)
- [LightRays](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/LightRays)
- [GradientWaves](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/GradientWaves)
- [SideRays](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/SideRays)
- [RippleGrid](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/RippleGrid)
- [PixelSnow](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/PixelSnow)
- [Topography](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Topography)
- [Dither](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Dither)
- [Orb](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Orb)
- [Beams](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Beams)

The adjacent MIT + Commons Clause license applies to every component. The original shader artwork is retained. Integration uses lazy imports, bounded render resolution, no global pointer effects and explicit pause handling. Preview images are actual local captures of the selected components.

Local lifecycle fixes: defer forced context loss until a canvas is detached so React Strict Mode can replay effects; retain the DarkVeil immutable-texture resize fix. New effects stop scheduling frames while paused, and disabled pointer interactions cannot wake them. Topography has an explicit paused control. Shared integration adapts theme/custom color, speed, light mode where supported and paused state without introducing a new runtime dependency.

The catalog contains 17 effects. Aurora, LiquidChrome and FloatingLines were removed; their saved IDs fall back to DarkVeil. Retained effects keep their existing IDs and previews.
