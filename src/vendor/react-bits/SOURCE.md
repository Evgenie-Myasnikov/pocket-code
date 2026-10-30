# React Bits backgrounds

Original TypeScript/CSS components are pinned to upstream commit `e12c22192ac7b4b452c5e2feb9b586d74765d696`:

- [DarkVeil](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/DarkVeil)
- [Aurora](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Aurora)
- [Iridescence](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Iridescence)
- [SoftAurora](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/SoftAurora)
- [Grainient](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Grainient)
- [LightPillar](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/LightPillar)
- [Galaxy](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Galaxy)
- [LiquidChrome](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/LiquidChrome)
- [Plasma](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Plasma)
- [FloatingLines](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/FloatingLines)

The adjacent MIT + Commons Clause license applies to every component. The original shader artwork is retained. Integration uses lazy imports, bounded render resolution, no global pointer effects and explicit pause handling. Preview images are actual local captures of the selected components.

Local lifecycle fixes: defer forced context loss until a canvas is detached so React Strict Mode can replay effects; retain the DarkVeil immutable-texture resize fix. FloatingLines stops scheduling frames when animation speed is zero and pointer/intro effects have settled. Shared integration adapts theme/custom color, speed, light mode and paused state without introducing a new runtime dependency.
