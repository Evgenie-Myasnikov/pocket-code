React Bits Dark Veil

Source: https://github.com/DavidHDev/react-bits/tree/e12c22192ac7b4b452c5e2feb9b586d74765d696/src/ts-default/Backgrounds/DarkVeil

Upstream component and license are retained. Pocket Code integration is in ChatAtmosphere.tsx.

Local fixes: recreate immutable WebGL texture storage on resize; ignore pointer wakeups when mouse interaction is disabled.

Cleanup deletes GPU resources without forcibly losing a reusable canvas context, so React Strict Mode effect replay can initialize again.
