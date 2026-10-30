---
name: Pocket Code Compact
colors:
  surface: '#101211'
  surface-container-low: '#171918'
  surface-container: '#202221'
  on-surface: '#eceeed'
  on-surface-variant: '#adb5b2'
  outline-variant: '#373b39'
  primary: '#1fd8a4'
  on-primary: '#101211'
  error: '#f09a90'
  secondary: '#86bdf0'
---

# Design System: Pocket Code Compact

## 1. Visual Theme & Atmosphere

A compact desktop workspace for conversations and visual planning. Quiet charcoal
surfaces carry the content; a jade accent identifies actions and selection. The
interface prioritizes readable conversation text and a large working canvas.

Small controls use restrained corners and close spacing. Avoid oversized capsules
around unrelated actions. Mobile controls keep larger touch targets. This document
describes the current compact surfaces, not a claim that every legacy screen has
been redesigned.

## 2. Color Palette & Roles

- Charcoal foundation `#101211`: application background.
- Raised charcoal `#171918`: rail, fields and panels.
- Soft charcoal `#202221`: elevated controls and selected neutral surfaces.
- Quiet divider `#373b39`: decorative separators; field boundaries use the stronger input token.
- Near-white `#eceeed`: primary text; silver sage `#adb5b2`: secondary text.
- Jade `#1fd8a4`: active controls and primary actions, with charcoal labels.
- Soft coral `#f09a90`: errors; blue `#86bdf0`: information; pair status with words or icons.

The YAML describes dark Sage. All ten paired palettes and light-mode adjustments
are documented in [UI colors](../docs/UI-COLORS.md); runtime values live in
`src/neutral-themes.css`. Never hardcode this one palette inside components.

## 3. Typography Rules

Golos Text is the readable UI family, Manrope provides heading emphasis, and
Consolas/JetBrains Mono serves code. Tokens define regular 400, medium 500,
semibold 600 and display 700 weights. Compact controls use 12–14 px type;
conversation copy starts at 14 px with configurable size and leading.
Heading tokens are 16, 20 and 24 px. Compact desktop board and chat titles use 14 px.
Secondary metadata is subordinate; it must not replace readable labels.

## 4. Component Stylings

- Buttons: desktop toolbar height 30–36 px, 6–8 px corners, 8 px icon/text gap.
  Use one clear primary action; secondary actions have quiet or transparent fills.
  Keyboard focus uses the accent ring. Do not remove focus to achieve compactness.
- Menus and dialogs: shared panel surface, subtle border and restrained shadow.
  Chat, card, provider and access menus use the same row spacing and state roles
  through `src/ui-menus.css`. Menu corners use `--material-menu`, rows use
  `--radius-sm`, and selected rows use `--bg-active` with an accent edge.
  Keyboard focus has its own ring; disabled and destructive actions stay distinct.
  Rows scale from 36 px on desktop and retain at least 44 px on coarse pointers.
- Navigation: one searchable chat list and a collapsible sidebar; no tile switch
  or Inbox. The active section uses an accent edge and stronger text, while
  hover is transient and inactive navigation recedes. Board header actions are
  image gallery, Chat and refresh icons. Desktop chat keeps a compact title and
  44 px back/menu targets; phone chat retains 48 px targets.
- Forms: 8–10 px padding, explicit labels, consistent input boundary and focus.
- Canvas: the single board view, with existing task cards and pastel sticky objects.
  Edit text inside objects. Right-click blank canvas (or use the keyboard
  context-menu key) to create. Left-drag empty canvas selects an area; middle-drag
  pans. Resize at edges/corners; approach a side midpoint, then hold briefly
  and drag from its connection port. Undo, redo, fit and AI following remain
  available in the toolbar. Card Properties/Agent actions appear for a single
  selected card and in its context menu, rather than on every card.
  Task dependencies are metadata, separate from user-drawn arrows. A compact
  receipt of a confirmed AI write can reveal its surviving affected objects;
  ordinary file refreshes and reads do not become AI-edit receipts.
- Gallery: loading, error and decoded previews reserve the same media slot.
  Preview originals or drag them to the composer. The add action appears on
  hover/focus and stays visible for touch. Image geometry stays stable during drag.
- Board chat: the project and saved conversation belong to the current board.
  A separate selection attachment describes the context of each new message.
  Opening it shows names, object types and available image previews, with a
  jump back to the source object. Do not expose raw IDs as visible labels.
  Embedded desktop chat actions live in the title context menu and Shift+F10;
  the title remains keyboard reachable while a turn runs.

## 5. Layout Principles

Use a 4 px spacing unit, reduced to 3 px by the existing compact preference.
Board toolbar padding is 8 by 12 px. The workspace fills available width rather
than a marketing-page maximum. Board/chat has a draggable divider with bounds,
keyboard adjustment, reset and separately remembered horizontal/stacked sizes.
Desktop starts with 58% for the board and stacks below 1000 px; the user's ratio
then takes precedence. On phones, board chat opens as an adjustable bottom sheet
while the board stays mounted; collapsing it preserves the chat and draft.
Board actions wrap below 700 px. Fine-pointer desktop controls can be compact;
coarse-pointer controls retain 44 px targets. Scrollable card content owns its
wheel gestures, including at its edges; Ctrl+wheel retains canvas zoom.

Left-align names and working content; reserve whitespace for reading and canvas
navigation. Motion tokens are 100/200/300 ms. Menus enter once with a short fade
and 2 px translation; closing and action execution remain immediate. The active
Stop and composer frame share a brighter 1.6-second breathing halo. Focus/press
adds one 1.35-second outward wave using opacity and transform, without changing
control geometry. Reduced-motion and forced-colors suppress decoration.

## 6. Design System Notes for Stitch Generation

Describe a quiet, dense desktop tool with neutral surfaces, restrained jade
accents and clear typography. Preserve the user's selected theme.

Example prompts:
- Design a compact board header with back, title and gallery/Chat/refresh icons.
  Keep the canvas prominent and the toolbar compact; show card actions in context.
- Design a chat beside a board with inherited project context, a short context
  chip and a clean composer. Do not add another project picker.

Iterate one surface at a time against real rendered captures. Check focus,
overflow, dark/light modes and touch sizes. This document was extracted from
React/plain-CSS source using Google's extract-design-md workflow; no Stitch
screen generation or upload was performed.

## 7. Reference Principles

These sources inform the shared Pocket Code system; they do not require replacing
its existing React components or adopting another product's palette.

- [Linear's 2026 refresh](https://linear.app/now/behind-the-latest-design-refresh):
  quiet navigation, clear content hierarchy and deliberate borders.
- [GitHub Primer ActionList](https://primer.style/product/components/action-list/):
  consistent rows for icons, labels, selection and supporting information.
- [Adobe Spectrum color](https://spectrum.adobe.com/page/using-color/):
  semantic roles and related surface levels across light and dark themes.
- [React Aria styling](https://react-aria.adobe.com/styling):
  independent hover, press, selection and keyboard-focus states.
- [Google supporting panes](https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts#supporting-pane):
  board as primary content and chat as a context-preserving adaptive companion.

The source styles and rendered checks remain authoritative for implemented
behavior. This document is a design contract, not validation or release evidence.

## 8. Shared material and background roles

`src/ui-materials.css` owns the shared fine edge, top rim, subtle sheen and
surface depth. Keep the selected palette; references describe material, not a
mandatory blue color. Controls use 14px corners, cards 22px and floating panels
28px. Navigation retains its compact layout and existing selection states.

| Surface | Material treatment |
| --- | --- |
| Chat/board menus and dialogs | Fine border, top rim, bounded blur, shared focus rings |
| Settings, account cards and output cards | Opaque readable fill, light sheen, no repeated blur |
| Review, agents and output panels | Shared edge and depth, existing layout retained |
| Composer and code blocks | Shared edge/radius; existing interaction effects remain |
| Board canvas | World-aligned line grid; adaptive spacing at distant zoom |

Forced colors remove decorative grid and gradients. Reduced transparency uses
opaque floating panels. Never add backdrop blur to hundreds of canvas objects.

Background settings offer DarkVeil plus ten original React Bits components:
Silk, Aurora, Iridescence, Gradient Blinds, Plasma Wave, Ghost Fibers, Flux Lines,
Lightfall, Molten Metal and Prismatic Burst. Their original shader code is pinned
and attributed in `src/vendor/react-bits/SOURCE.md`. The earlier custom CSS
approximations were rejected and replaced, not retained under the upstream names.
Only the selected effect is lazy-loaded; thumbnails are actual rendered captures.
Choice persists locally; unknown/removed styles fall back to DarkVeil. Color,
intensity and speed remain configurable; the original artist palette is used
until a custom color is selected. Speed zero and reduced motion pause rendering.

The composer is the shared matte material reference: translucent fill, bounded
backdrop blur, soft depth and no luminous outline. Other UI surfaces inherit
this treatment through shared material tokens.
Keep the content crisp and clicks unobstructed; reduced transparency and forced
colors retain an opaque accessible surface. Backdrop text beneath glass is diffused; foreground content remains sharp.

The glass edge has a subdued contour without a light rim. Account quota
is a ring outside the composer on the right: hover or keyboard focus reveals
the remaining percentage; click opens quota details. The 48px target remains
inside the viewport. Very narrow composers separate model controls and actions
into two rows rather than overlapping them. Quota data remains provider-sourced.

Menus, dialogs, title/actions, settings cards, supporting panels, navigation and
board chrome share the matte roles. Keep clear field boundaries, keyboard focus,
selection and semantic status colors. Repeated canvas objects never gain blur.

Floating controls, settings cards and supporting panels use translucent fills
and 36px backdrop diffusion. Foreground content stays sharp. Avoid repeated
blur on large canvas/chat lists; nested controls share their parent backdrop.
Reduced transparency and forced colors use opaque surfaces.
