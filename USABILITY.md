# Usability review — 2026-09-30

This is an expert review supported by interface checks and published guidance. It is not a study with participants, an accessibility certification, or proof that every Android device behaves identically.

## Focused settings and chat controls — 2026-10-01

The home screen now prioritizes workspace selection, new chat, search and conversations. Connection details, branding and version information moved to dedicated settings pages. Settings presents seven categories, one page at a time, with predictable Back/focus restoration. A red disconnect action stays below the content scroll area without covering controls. Codex access explanations are initially collapsed behind a question-mark button.

Review appears only when the selected project has an available working-tree or branch comparison. Results and reading mode appear only when there is relevant content. Account usage is isolated in its own settings page, with actual window durations, remaining allowance and dated reset information; unavailable values do not become zero usage.

Conversation labels, tool cards, code and file changes follow chat text size, while interactive targets retain their independent minimum size. Light-theme active navigation and selected conversation titles use theme-appropriate contrast. These changes address the user's reported visual clutter and inconsistent scaling; they do not establish participant-tested usability.

## Phone sizing references — 2026-09-30

Current manufacturer references cover compact, large and folding phones:

| Reference device | Published display | Layout implication |
| --- | --- | --- |
| Galaxy S26 | 6.3-inch, 1080 × 2340 | Compact portrait and reduced-height landscape. |
| Galaxy S26+ / S26 Ultra | 6.7 / 6.9-inch, 1440 × 3120 | Larger portrait, including increased display zoom. |
| Pixel 11 / Pixel 11 Pro XL | 6.3-inch, 1080 × 2424 / 6.8-inch, 1344 × 2992 | Tall compact and large phone work areas. |
| Pixel 11 Pro Fold | 6.5-inch cover, 1080 × 2342; 8-inch inner, 2076 × 2152 | Cover-screen and wider unfolded layouts. |

Sources: [Samsung's 2026 first-quarter report](https://images.samsung.com/is/content/samsung/assets/global/ir/docs/2026_1Q_Interim_Report.pdf) and [Google's current Pixel hardware specifications](https://support.google.com/pixelphone/answer/7158570?hl=en).

Panel resolution and diagonal do not determine an app's available logical width. Android density, display zoom, system bars, navigation mode, split-screen and the keyboard change the usable window. Following [Android window-size guidance](https://developer.android.com/develop/ui/views/layout/use-window-size-classes), browser checks therefore exercise a range of logical work areas rather than claiming that a CSS viewport is an exact hardware-device test. The Android wrapper handles system insets natively and requests keyboard resizing; browser simulations cannot verify a particular phone's IME or WebView.

## Evidence and changes

| User difficulty observed in this app | Change | Basis |
| --- | --- | --- |
| Small copy, attachment, model and header controls were difficult to tap, especially with compact text. | Mobile controls keep at least 48 CSS px hit areas, independently of text scale. Layout is checked at 320/390 px and 60/100% scale. The native viewport still requires device verification. | [Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/apps) recommends 48 dp touch targets. |
| Failed automatic connection could leave empty address/key fields despite a saved connection. | Saved values fill untouched fields when storage finishes loading; manual edits and deliberate clearing are preserved. | [NN/G error-message guidelines](https://www.nngroup.com/articles/error-message-guidelines/) emphasize recovery without losing the user's work. |
| Opening another chat discarded unfinished text and selected attachments. | Each conversation/project keeps its draft while the connection remains open. Workspace changes also preserve it. | [NN/G user control and freedom](https://www.nngroup.com/articles/user-control-and-freedom/) explains predictable reversal and recovery. |
| Project switching was hidden in Settings while a decorative arrow suggested a header control. | The header now contains an actual project selector. | Recognition and direct control reduce unnecessary navigation. This application-specific design choice needs user validation. |
| The chat footer could remain green during network failure. | Text and indicator distinguish connection loss, running work, waiting for a decision and an idle connection. | [NN/G visibility of system status](https://www.nngroup.com/articles/visibility-system-status/) includes mobile eye-tracking observations about uncertainty when feedback is missing. |
| Review/image/confirmation dialogs did not consistently contain focus or support Back. | Focus enters the dialog, the background becomes inert, Tab stays inside, Back/Escape closes it and focus returns to the trigger. Android Back returns through screens before minimizing. | [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) and [Android Back guidance](https://developer.android.com/design/ui/mobile/guides/patterns/predictive-back). |
| A tool call and its matching output occupied separate cards; raw `codexItem` labels added technical noise. | Adjacent matching call/output blocks share one collapsed card. Errors remain visible in the summary, all original input/output stays available, and unknown Codex activities have a human-readable summary. | [NN/G progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) supports keeping secondary detail available on demand. Cognitive-load reduction is a design hypothesis, not a measured participant outcome. |

## Validation performed

- Browser scenarios cover compact touch targets, keyboard focus, reconnect recovery, manual field protection, separate workspace and chat drafts, attachments, project selection, dialog focus, Back/Escape and background history refresh.
- Screenshots were inspected at phone width. Android source was compiled; a physical phone and TalkBack were unavailable.
- GitHub updates, provider isolation, file scope, approvals, interruption and reconnect races were separately checked as engineering behavior.
- The responsive matrix passed all 64 combinations: portrait 320×640, 360×760, 384×824, 393×852, 412×892 and 440×956 at 60/65/100/130% typography in English/Russian; reduced-height 360×380, landscape 844×390 and folding-window 720×740/884×900 at 100/130% in both languages. Checks cover lists, chat, reading mode, Review and Settings, including bounds, header separation and 48 px touch areas.
- Synthetic screenshots were inspected for compact 65% settings/chat/reading, large 130% chat, and a reduced-height Review window. The reduced-height browser case simulates available space, not a physical Android keyboard.

- Final integration: all 128 browser scenarios passed, with 101 Node checks and a successful Android build. Project documents were additionally checked at 320 px/130% English and 360 px Russian; Results at 320 px/130% in both languages and landscape 844 px. These are browser working-area checks, not physical device certification.

## Jobs context boundaries

Jobs separates browsing, task detail and action confirmation. The list shows search, a category selector and compact task summaries; bulk selection is an explicit mode. The task screen shows its description, saved chat/PR links and only the next actions available for the chosen role. Folder/mode controls, required Jira fields and PR details appear in their relevant action forms. The queue is collapsed by default, while interrupted actions expose recovery in the task context. This applies progressive disclosure; whether it reduces users' cognitive load still needs participant testing.

Agent cards similarly separate a short activity indication from the child's full context. A drawer on wider windows becomes a full-width panel on phones. Its Back path is child → agent list → parent chat; drafts remain in the parent. Missing transcript/status information is explicit, and a nested image closes before leaving the agent context.

Project keeps Rules, Changelog and Files together under one navigation item. The document reader has its own Back action and preserves list position. Results opens only on request: categories filter the loaded conversation, assistant outputs and user sources are separate, and recent items appear first. Media and file previews require selection; long agent names expand on demand.

## Suggested participant session

Use a clean installation with a test PC and synthetic conversations. Ask a participant to connect by QR, switch to Codex, select a project, send a picture, approve or reject an action, inspect Review, return to an unsent draft and recover after the PC connection is interrupted. Observe without explaining controls first.

Record task completion, wrong turns, lost work, accidental actions and the participant's own explanation of which agent/project is active. Test one-handed use, the software keyboard, Android Back, TalkBack and large system text. Prioritize repeated failures over cosmetic preferences. APK installation and camera/PDF behavior also need physical-device checks.

## Deliberate limits

- 8 px chat text and 60% scale remain optional advanced preferences at the user's request; these settings are not a readability recommendation. Reset returns normal appearance.
- Draft retention is in memory for this connection. Force-closing the app or forgetting the connection can discard drafts; connection and appearance preferences persist separately.
- The current live terminal belongs to Claude. Codex uses structured chat, with an explicit notice instead of accidentally opening the wrong engine.
