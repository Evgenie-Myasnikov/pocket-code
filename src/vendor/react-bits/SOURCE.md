React Bits Dark Veil

Source: https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/DarkVeil

Upstream component and license are retained. Pocket Code integration is in ChatAtmosphere.tsx.

Local fixes: recreate immutable WebGL texture storage on resize; ignore pointer wakeups when mouse interaction is disabled.

Cleanup deletes GPU resources without forcibly losing a reusable canvas context, so React Strict Mode effect replay can initialize again.

## Additional backgrounds

The following original React Bits TypeScript/CSS components are vendored from the same pinned commit `e12c22192ac7b4b452c5e2feb9b586d74765d696`:

- [Silk](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Silk)
- [GradientBlinds](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/GradientBlinds)
- [PlasmaWave](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/PlasmaWave)
- [GhostFibers](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/GhostFibers)
- [FluxLines](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/FluxLines)
- [Lightfall](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Lightfall)
- [MoltenMetal](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/MoltenMetal)
- [PrismaticBurst](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/PrismaticBurst)
- [Aurora](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Aurora)
- [Iridescence](https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/Iridescence)

The adjacent MIT + Commons Clause license applies to all these components.
Integration: lazy imports, bounded render resolution, disabled global pointer effects, paused motion and retained upstream shader artwork. Reusable canvas components release GPU resources and defer context loss until the canvas is detached, preserving React Strict Mode replay; MoltenMetal creates/removes a fresh canvas and retains its upstream context cleanup. Preview images are local captures of these components, not CSS approximations.
