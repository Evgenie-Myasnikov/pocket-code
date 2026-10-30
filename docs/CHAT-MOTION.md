# Chat interaction motion

The implementation was compared with 48 chat/message files in
[AionUi at 11cd2a9](https://github.com/iOfficeAI/AionUi/tree/11cd2a9a20d1e033157636efc570b41384c66d85/packages/desktop/src/renderer).
These are independently implemented interaction patterns using Pocket Code tokens;
no AionUi runtime or animation library is bundled.

| Reference behavior | Pocket Code implementation | Verification |
| --- | --- | --- |
| Incremental response text, `hooks/chat/useTypingAnimation.ts` | Existing grapheme-safe pacing and new-character fading retained. Loaded history and reopened active snapshots appear immediately. | Streaming reveal and transcript-follow checks. |
| History skeleton shimmer, `Messages/MessageList.tsx` | `ChatHistorySkeleton` appears during an empty history read. Cached content keeps its own layout and a small loading status. | Narrow/wide skeleton and reduced-motion checks. |
| Smooth following and jump to latest, `Messages/useAutoScroll.ts` | One retargetable animation follows rendered height; explicit latest uses the same controller. Initial entry snaps. Wheel up, touch reading and keyboard navigation cancel following. | Intermediate positions, manual interruption, late image size and reduced-motion checks. |
| Thinking/tool disclosure arrows and hover feedback | Fixed-size chevrons rotate; expanded content fades in. Lazy materialization remains. | Tool disclosure and keyboard-focus checks. |
| Active tool breathing, `MessageToolGroupSummary.css` | Active grouped tools pulse gently. Completed groups and unknown connection state do not pulse. | Active/completed and reduced-motion checks. |
| Message action hover, `MessageText.tsx` | Desktop assistant Copy fades in on hover/focus. Touch actions remain visible; copying confirms with the existing check mark and a small icon effect. | Clipboard contents, focus visibility and reduced-motion checks. |
| Send-box focus/drag colors and Stop glow, `chat/SendBox` | Existing focus/drag transitions plus a brighter fixed-size breathing halo shared by Stop and the composer frame; retry/stopping states remain static. Input press/focus adds one fading outward border wave. Latest-button hover/press feedback uses transforms without layout changes. | Composer geometry and state checks. |
| Newly arriving live content | A short entrance fade for new live messages. History pagination and reentry do not replay it. | Snapshot/live distinction and transcript regression checks. |

Reduced-motion and forced-colors preferences suppress decorative animations.
Animations do not change provider text, tool execution, approval semantics or saved
chat positions. Infinite feedback applies only to visible loading/active states;
scroll frames stop when idle, hidden, detached or manually interrupted.

AionUi's voice waveform, microphone spinner, conversation-fork controls and session
mention chips belong to features that Pocket Code does not provide in this chat.
They do not introduce those features through this motion update. This is a complete
mapping of the applicable audited chat patterns, rather than a copy of the whole
AionUi application.

## Composer motion refinement

The active halo keeps its original 1.6-second alternating breathing rhythm. Its
higher-contrast ring blends the theme accent with foreground text and animates
opacity without changing input or button geometry. A separate 1.35-second border
wave responds once to input press or keyboard focus; it never intercepts input.
Reduced-motion and forced-colors suppress both decorations.

[AionUi Stop breathing](https://github.com/iOfficeAI/AionUi/blob/11cd2a9a20d1e033157636efc570b41384c66d85/packages/desktop/src/renderer/components/chat/SendBox/sendbox.css#L215)
and its [focus-ring hook](https://github.com/iOfficeAI/AionUi/blob/11cd2a9a20d1e033157636efc570b41384c66d85/packages/desktop/src/renderer/hooks/chat/useInputFocusRing.ts)
are the reference for breathing and focus feedback. The single outward wave is
an independent extension, not a claimed AionUi feature. No animation dependency
is needed for these two effects.

## Ready chat components and compact navigation (unreleased)

Pocket Code now embeds [assistant-ui](https://www.assistant-ui.com/components)
0.15.32 through its external-store runtime. Provider messages remain authoritative;
the existing composer, uploads, board-selection attachments, approvals, tool and
reasoning renderers, history pagination and scroll restoration remain in place.
Message actions provide copy, quote into the current draft, reuse a user message,
Markdown export and browser speech synthesis when available. Export contains message
text, not tool logs or image binaries. Editing old turns, regeneration, branches,
feedback submission and voice input are not provided by this adapter.

The lazy-loaded React Bits Dark Veil source is pinned and attributed in
[src/vendor/react-bits/SOURCE.md](../src/vendor/react-bits/SOURCE.md). Bundles include
[third-party notices](../public/third-party-notices.txt). The theme-colored background
uses quarter-resolution shader fields and DPR 1. Existing conversations pause it;
hidden chats unmount it. Reduced motion and forced colors suppress WebGL decoration.
Pointer interaction is disabled, and resizing recreates immutable texture storage.

The desktop sidebar has a narrow navigation rail and a separate compact list of
projects and recent chats. Project buttons toggle a chat filter; they do not switch
the open conversation. Search, provider choice, running status, keyboard navigation,
width resizing and collapse persistence remain available. Dates and project details
are in chat-row tooltips rather than repeated on every row.

## Buffered presentation refinement (unreleased)

The existing grapheme-safe presentation buffer now drains network bursts within
750 ms, using a short initial hold and backlog-dependent pacing. Completion drains
the remaining presentation within 220 ms. These are foreground scheduling targets;
hidden or overloaded browsers can delay animation frames. Speed zero and reduced
motion reveal the full text immediately. Provider text remains authoritative.

Partial and completed responses share their React/Markdown identity, so completion
keeps the displayed prefix and continues the same buffer instead of replaying or
replacing it. Stale shorter streaming snapshots cannot rewind visible text; final
corrections remain authoritative. Loaded history appears immediately. These changes
extend the existing implementation after reviewing the pinned AionUi typing hook;
no upstream code or new animation dependency is bundled.

All ordinary assistant text and images remain visible above the turn's collapsed
Thinking group while work continues. Thinking contains internal reasoning, tools
and service events only. History pagination briefly retains its visible anchor
while Markdown finishes layout; manual input cancels that adjustment.

Floating chrome uses a softer 14 px backdrop blur. Allowance is drawn around the Send/primary Stop control without reserving
a separate width column. The sidebar library
uses one full-height scroll area for navigation, projects and recent conversations.
Saved chats resume without a manual PC-finished prompt. Independent interactive
histories can run in one project; duplicate history writers, provider locks and
server capacity limits remain enforced. Task-pipeline project isolation is retained.

## Typography and live backgrounds (unreleased)

Reviewed AionUi's pinned `Messages/components/MessageText.tsx` and
`components/Markdown/index.tsx`: message identity, Markdown rendering, code/media
renderers and presentation styles remain separate. Pocket Code retains its own
Streamdown/assistant-ui pipeline and safe content handling; it does not import
AionCore or upstream raw-HTML rendering. Shared prose roles now govern headings,
paragraph/list rhythm, code fonts and action-icon metrics. Existing text-size,
line-spacing and alignment preferences remain authoritative.

Appearance offers Golos Text, Manrope and System for chat prose/input. Golos Text
remains the bundled Cyrillic-capable default, Manrope handles headings and
JetBrains Mono handles chat code. Review keeps its existing measured monospace
stack. Golos Text, Manrope and JetBrains Mono faces are bundled; System uses
device fonts. No remote font service is required.

The background catalog now has ten original React Bits effects: DarkVeil, Aurora,
Iridescence, SoftAurora, Grainient, LightPillar, Galaxy, LiquidChrome, Plasma and
FloatingLines. Source attribution and lifecycle adaptations are in
[the vendor source record](../src/vendor/react-bits/SOURCE.md). Removed effects
and their posters are no longer shipped by this catalog. Stored removed IDs
fall back to DarkVeil. Active shaders receive the actual theme/custom color;
static posters no longer show underneath live artwork. Preview remains available
when the chat background is disabled, stays visible while adjusting controls,
and is exempt from the embedded-chat background suppression rule.

One footer row contains composer actions on narrow layouts. The allowance ring
surrounds Send, or primary Stop while a turn runs, on both desktop and phone.
The center sends/stops, the outer annulus opens details, hover/focus shows the
percentage, and keyboard activation remains a separate accessible quota action.
The ring cannot intercept center clicks. Malformed host usage responses show an
unavailable state instead of crashing the details view.
