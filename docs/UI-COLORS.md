# UI color roles

Named palettes use [Radix Colors](https://github.com/radix-ui/colors), with the
upstream license in `RADIX-COLORS-LICENSE.txt`. Values were retrieved on 2026-10-24.
The source files are `src/light.ts` and `src/dark.ts` in that repository.

| Theme | Neutral scale | Accent scale |
|---|---|---|
| Neutral | Sand | Gray |
| Codex | Gray | Gray |
| Claude | Sand | Bronze |
| Copilot | Slate | Blue |
| Sage | Sage | Jade |
| Ocean | Slate | Cyan |
| Lilac | Mauve | Iris |
| Rose | Mauve | Ruby |
| Amber | Sand | Amber |
| Mint | Sage | Teal |

Names are existing product preferences, not claims of official provider branding.
Background, panel and raised surface use neutral steps 1, 2 and 3. Decorative
dividers use step 6. Secondary and primary text use steps 11 and 12. Accent text
uses step 11; in light Copilot, Sage, Ocean, Amber and Mint it is mixed 10% toward the neutral foreground to meet 4.5:1 on raised surfaces. Primary buttons use the same fill with a contrasting label. Control
boundaries, focus, hover, selection and semantic statuses use shared token roles.
Errors, warnings and success remain recognizable across all themes.

The role mapping follows [Radix scale guidance](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale).
[Material color roles](https://m3.material.io/styles/color/the-color-system) and
[Fluent neutral, brand and semantic colors](https://fluent2.microsoft.design/color)
informed the separation of surfaces, accent and status. Values are from Radix;
they are not mixed samples from screenshots of those products.

`tests/palette-contrast.test.ts` checks WCAG contrast of primary, secondary and
accent text against all three surfaces and of primary button labels in all
20 theme combinations. This numeric check does not replace visual inspection
or certify accessibility of every application state.
