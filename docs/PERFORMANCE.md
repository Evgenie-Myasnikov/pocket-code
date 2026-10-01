# Performance audit

Audit date: 2026-10-01. Scope: chat typing, history updates, streaming snapshots, scrolling, large diffs, navigation, read concurrency, visibility and lifecycle cleanup.

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
