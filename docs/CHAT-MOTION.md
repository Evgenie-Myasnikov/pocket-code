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
