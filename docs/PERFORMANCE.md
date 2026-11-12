# Performance audit

Audit date: 2026-10-01. Scope: chat typing, history updates, streaming snapshots, scrolling, large diffs, navigation, read concurrency, visibility and lifecycle cleanup.

This is a historical benchmark, not a measurement of the current working tree. See the [2026-10-06 maintenance report](MAINTENANCE-2026-10-06.md) for later changes and actual validation. Do not reuse the numbers below as evidence for a newer build.

## Reproduce

```sh
npm ci
npm run build
node scripts/benchmark-ui.mjs --dist dist --out .local/performance.json --runs 1
npx playwright test tests/chat-performance.spec.ts tests/review-performance.spec.ts
npx tsx --test tests/chat-snapshot.test.ts tests/visible-poll.test.ts tests/performance-reads.test.ts
```

The UI benchmark serves a production build locally and intercepts API calls with fictional data. It uses Chrome, a 390 × 844 CSS-pixel viewport, 4× CPU slowdown, 500 rich messages and a 20,000-line patch. It does not connect to an AI account or a real project. Close other CPU-heavy tasks when comparing builds; keep the browser, machine and workload unchanged.

CPU throttling is a useful regression tool but does not reproduce a phone's CPU, WebView, memory pressure or battery behavior. See [Chrome's device emulation limits](https://developer.chrome.com/docs/devtools/device-mode) and [CPU measurement guidance](https://developer.chrome.com/blog/devtools-grounded-real-world).

## Measured results

Comparison: production 0.19.1 versus the 0.19.2 changes on the same computer/browser. These are individual synthetic stress runs, not an average across phones. The chat workload uses 500 messages with Markdown, tables, code and closed command output; typing includes eight characters and a 20 ms scripted delay between characters.

| Chat scenario | Before | After |
| --- | ---: | ---: |
| Open 500-message history | 3,615 ms | 1,679 ms |
| Type eight characters | 14,119 ms | 292 ms |
| Typing long tasks over 50 ms | 12 | 0 |
| Chat scroll frame-gap p95 | 1,485 ms | 21 ms |
| Display the eighth streamed update | 33,349 ms | 6,912 ms |
| Long tasks during streaming | 43 | 1 |

The streaming test includes the normal polling interval, so its elapsed time is not pure rendering time. Scroll measurements are capped by duration/frame count and have different frame counts when the old build stalls; p95 values are descriptive rather than a statistical cross-device guarantee.

The diff comparison was run separately with the same 500 saved messages, no streaming job, and a list response with an empty patch followed by the selected file's patch. Readiness means the first code line is visible, not merely that an empty table has mounted.

| 20,000-line diff scenario | Before | After |
| --- | ---: | ---: |
| Open selected diff | 22,739 ms | 517 ms |
| Mounted table rows | 20,001 | 49 |
| Scroll frame-gap p95 | 1,791 ms | 27.8 ms |
| JavaScript heap with Review open, after GC | 70.21 MB | 13.78 MB |
| Long-task time during the idle refresh observation | 12,208 ms | 0 ms |

[Machine-readable results](performance-results.json) retain the matching scenarios, including the final production-build diff recheck after layout and image-viewer fixes. General navigation checks used empty synthetic Tasks/Project/Settings pages, not live Jira. Zero long tasks in one observation does not guarantee that later workloads never stall.

Three additional open/close cycles of the new Review returned to exactly the same 23,774 DOM nodes and 715 event listeners. Post-GC JavaScript heap changed from 12.62 to 12.68 MB. This showed no accumulating DOM/listeners in this scenario; it is not proof that every memory leak is absent.

Server fixtures use fake RPC responses and temporary Git repositories; no real AI/Jira calls:

| Server scenario | Before | After |
| --- | ---: | ---: |
| Normalize 5,000 Codex messages / 8.47 MB | 158–175 ms | 15–25 ms |
| Three concurrent Codex session lists | 3 RPCs | 1 RPC |
| Review availability, clean feature branch | 983 ms / 11 Git processes | 442 ms / 7 |
| Review availability, 100 changed files | 543 ms / 6 Git processes | 253 ms / 4 |
| Review file list | 558 ms | 338 ms |
| Review selected file | 613 ms | 403 ms |

Git timing is sensitive to process launch and filesystem caching. The reduced command counts and single-flight behavior also have deterministic regression tests.

## Changes verified in source

- **Typing and polling:** unchanged messages retain their identity. The message list, individual messages and Markdown avoid repeated work when unrelated state changes. Updates to linked tool results, subagents and language still invalidate the relevant content. This follows [React's guidance on measuring and memoizing expensive rendering](https://react.dev/reference/react/memo).
- **Collapsed commands:** their output is mounted and parsed when expanded. Closing a disclosure releases its rendered body; underlying history remains available.
- **Large diffs:** only visible rows and a small overscan region are mounted. Parsing depends on patch/layout changes, not scrolling or header interactions. Fixed-height, non-wrapping code rows preserve the scroll range and line numbers. Browser text selection/search only covers currently mounted diff rows; full patch data remains available in memory.
- **Background work:** UI history, session, project, provider and job polling pauses when document visibility is hidden and refreshes on return. Requests do not overlap. Host jobs and the Android status service have separate lifecycles and continue running.
- **Local cache:** identical history/session polls and partial answer text no longer cause repeated cache writes. Completed history is still saved.
- **Server reads:** concurrent identical reads share pending work, with project paths revalidated for permission-bearing reads. Session and history results are not retained after completion, so renamed chats and removed projects remain immediately observable.
- **Codex normalization:** history-size accounting serializes each item once while preserving the existing size cap.
- **Git availability:** checking whether Review should appear uses change existence rather than counting all changed lines. Both comparison modes reuse a safe Git context; configured Git filters remain disabled. Independent metadata reads run concurrently.

## Limits and remaining costs

- Physical Android frame pacing, thermal behavior, background suspension and battery use were not measured.
- Results image thumbnails load near the visible area with at most two concurrent reads/decodes. They release object URLs when off-screen. The current local artifact endpoint transfers the original image before client-side downsampling, so this bounds decoding and retained memory, not the transferred size of each file.
- Codex still reads all paginated items before producing a history window. A synthetic 5,000-message history requires 51 RPC calls per uncached scan. This remains a transport cost even after CPU normalization improved.
- Changed job snapshots still carry the accumulated messages. Revision checks avoid unchanged snapshots, but this is not a delta transport.
- The chat transcript retains loaded message content up to the existing history window limit. It is not a fully virtualized transcript; very large Markdown documents and initial history loading remain workload-dependent. Returning to the 500-message chat after another tab still took about 2.16 seconds in the new build because Markdown is mounted again. This remains a visible cost in the stress case.
- Foreground WebView and Android service activity polling can overlap. Both are bounded; this audit did not implement a foreground ownership handoff.
- Tests use synthetic content and predictable local responses. They do not establish performance under mobile packet loss or a slow external AI/Jira service.

## Board canvas and host (unreleased)

Measured 2026-11-12 on one Windows PC with Chrome on its GPU, 1920 × 1080, no CPU
throttling. Workload: a copy of a real repository board — 74 cards, 257 canvas
objects, 105 connections, 147 image references, a 1.2 MB file. "Before" is the
0.28.40 host and UI build; "after" is this working tree. Both runs used the same
script back to back; each is a single run, not an average across machines.

```sh
npm run build
node scripts/benchmark-board.mjs --root <copy of a project folder with a board> --out .local/board.json
```

The script starts a real host on a synthetic token, serves the production build,
reads and saves the board through the host API and drives the board in Chrome.
It changes the board it is given: always pass a copy.

| Scenario | Before | After |
| --- | ---: | ---: |
| Host reads the board (p50) | 78 ms | 15 ms |
| Board response size | 1,162,550 bytes | 660,614 bytes |
| Host saves the board (p50) | 220 ms | 40 ms |
| Open the board in the UI | 581 ms | 424 ms |
| Fit the whole board | 402 ms | 76 ms |
| Pan with the whole board in view, frame p95 | 41.7 ms | 7.1 ms |
| Pan with the whole board in view, frames over 25 ms | 34 of 187 | 0 of 181 |
| Zoom with the whole board in view, frame p95 | 34.6 ms | 7.0 ms |
| Zoom at 100%, style recalculation for 40 steps | 658 ms | 31 ms |
| Move a sticky by keyboard, edit to saved (p50) | 314 ms | 93 ms |
| Drag a card across the board, 30 steps to saved | 2,020 ms | 506 ms |
| Drag a card, frames over 25 ms | 35 of 126 | 1 of 68 |
| Reopen the board: image originals downloaded | 9 (15.7 MB) | 0 |

What changed:

- Zoom set one inherited CSS variable on the canvas world, which restyled every
  object on each step. Only the selected, hovered or marked object follows the
  zoom now.
- Every object carried four hidden connection-port buttons (over a thousand on
  this board). Ports exist only on the object that can use them.
- Each card had three scroll containers (text, metadata, images): several hundred
  compositor layers rebuilt on every pan frame. Only the card under the pointer,
  the selected or the focused card scrolls; the gutter is reserved so text does
  not reflow.
- The board screen rebuilt the canvas value and the card renderer on every render,
  so every object rendered again after each gesture. Both are memoised.
- The host parsed and validated the file several times per read and per save and
  asked Git for branch links each time. A read is cached by the file's metadata
  stamp, branch links for five seconds, and a save validates once.
- Card descriptions were stored twice (card record and canvas object). They are
  stored once, which nearly halves the file and every response.
- After its own save the viewer no longer downloads the board a second time from
  the live poll.
- Image previews are made once and kept on the device (IndexedDB, keyed by the
  content hash in the asset name), so reopening a board does not download the
  originals again. The first view still reads each visible original once.

Board MCP answers on the same board (characters of the tool result, one call each):

| Tool call | Before | After |
| --- | ---: | ---: |
| `read_board` without paging | 836,798 | 157,468 (summary; `detail: "full"` returns everything) |
| `update_note`, one field | 836,800 | 1,203 |
| `canvas_patch`, one object | 836,799 | 648 |
| `read_objects`, one card | 10,107 | 5,459 |
| `board_overview` | 3,041 | 3,096 |

A write used to answer with the whole board; it now answers with the new revision
and the objects that changed.

Not measured: the Windows desktop window (WebView2 and its bridge), phones, and
boards larger than this one. Opening is still dominated by laying out the text of
every card at once.
