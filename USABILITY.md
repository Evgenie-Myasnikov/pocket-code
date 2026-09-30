# Usability review — 2026-09-30

This is an expert review supported by interface checks and published guidance. It is not a study with participants, an accessibility certification, or proof that every Android device behaves identically.

## Evidence and changes

| User difficulty observed in this app | Change | Basis |
| --- | --- | --- |
| Small copy, attachment, model and header controls were difficult to tap, especially with compact text. | Mobile controls keep at least 48 CSS px hit areas, independently of text scale. Layout is checked at 320/390 px and 60/100% scale. The native viewport still requires device verification. | [Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/apps) recommends 48 dp touch targets. |
| Failed automatic connection could leave empty address/key fields despite a saved connection. | Saved values fill untouched fields when storage finishes loading; manual edits and deliberate clearing are preserved. | [NN/G error-message guidelines](https://www.nngroup.com/articles/error-message-guidelines/) emphasize recovery without losing the user's work. |
| Opening another chat discarded unfinished text and selected attachments. | Each conversation/project keeps its draft while the connection remains open. Workspace changes also preserve it. | [NN/G user control and freedom](https://www.nngroup.com/articles/user-control-and-freedom/) explains predictable reversal and recovery. |
| Project switching was hidden in Settings while a decorative arrow suggested a header control. | The header now contains an actual project selector. | Recognition and direct control reduce unnecessary navigation. This application-specific design choice needs user validation. |
| The chat footer could remain green during network failure. | Text and indicator distinguish connection loss, running work, waiting for a decision and an idle connection. | [NN/G visibility of system status](https://www.nngroup.com/articles/visibility-system-status/) includes mobile eye-tracking observations about uncertainty when feedback is missing. |
| Review/image/confirmation dialogs did not consistently contain focus or support Back. | Focus enters the dialog, the background becomes inert, Tab stays inside, Back/Escape closes it and focus returns to the trigger. Android Back returns through screens before minimizing. | [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) and [Android Back guidance](https://developer.android.com/design/ui/mobile/guides/patterns/predictive-back). |

## Validation performed

- Browser scenarios cover compact touch targets, keyboard focus, reconnect recovery, manual field protection, separate workspace and chat drafts, attachments, project selection, dialog focus, Back/Escape and background history refresh.
- Screenshots were inspected at phone width. Android source was compiled; a physical phone and TalkBack were unavailable.
- GitHub updates, provider isolation, file scope, approvals, interruption and reconnect races were separately checked as engineering behavior.

## Suggested participant session

Use a clean installation with a test PC and synthetic conversations. Ask a participant to connect by QR, switch to Codex, select a project, send a picture, approve or reject an action, inspect Review, return to an unsent draft and recover after the PC connection is interrupted. Observe without explaining controls first.

Record task completion, wrong turns, lost work, accidental actions and the participant's own explanation of which agent/project is active. Test one-handed use, the software keyboard, Android Back, TalkBack and large system text. Prioritize repeated failures over cosmetic preferences. APK installation and camera/PDF behavior also need physical-device checks.

## Deliberate limits

- 8 px chat text and 60% scale remain optional advanced preferences at the user's request; these settings are not a readability recommendation. Reset returns normal appearance.
- Draft retention is in memory for this connection. Force-closing the app or forgetting the connection can discard drafts; connection and appearance preferences persist separately.
- The current live terminal belongs to Claude. Codex uses structured chat, with an explicit notice instead of accidentally opening the wrong engine.
