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
Heading tokens are 16, 20 and 24 px. The compact board title is 14 px.
Secondary metadata is subordinate; it must not replace readable labels.

## 4. Component Stylings

- Buttons: desktop toolbar height 30–36 px, 6–8 px corners, 8 px icon/text gap.
  Use one clear primary action; secondary actions have quiet or transparent fills.
  Keyboard focus uses the accent ring. Do not remove focus to achieve compactness.
- Menus and dialogs: shared surfaces, subtle border and restrained shadow.
  Menus use the existing 12 px radius token; dialogs use 16 px.
- Navigation: a compact provider dropdown, independent list/grid icons, soft
  active background. The board header contains title, view switch and actions.
- Forms: 8–10 px padding, explicit labels, consistent input boundary and focus.
- Canvas: spatial objects with distinct pastel sticky colors and visible selection.
  Task dependencies are metadata, separate from user-drawn arrows.
- Board chat: adjacent pane on desktop; project is inherited from the board.
  A small context chip replaces raw metadata in the composer.

## 5. Layout Principles

Use a 4 px spacing unit, reduced to 3 px by the existing compact preference.
Board toolbar padding is 8 by 12 px. The workspace fills available width rather
than a marketing-page maximum. Board/chat uses a flexible board and a 42% chat
pane, stacking below 1000 px. Board actions wrap below 700 px. Fine-pointer
desktop controls can be compact; coarse-pointer controls retain 44 px targets.
Left-align names and working content; reserve whitespace for reading and canvas
navigation. Motion tokens are 100/200/300 ms with reduced-motion overrides.

## 6. Design System Notes for Stitch Generation

Describe a quiet, dense desktop tool with neutral surfaces, restrained jade
accents and clear typography. Preserve the user's selected theme.

Example prompts:
- Design a compact board toolbar with back, title, two view options, discuss,
  add note and refresh. Keep the canvas prominent and avoid a second title row.
- Design a chat beside a board with inherited project context, a short context
  chip and a clean composer. Do not add another project picker.

Iterate one surface at a time against real rendered captures. Check focus,
overflow, dark/light modes and touch sizes. This document was extracted from
React/plain-CSS source using Google's extract-design-md workflow; no Stitch
screen generation or upload was performed.
