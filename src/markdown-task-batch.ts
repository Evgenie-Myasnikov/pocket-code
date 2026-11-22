export type MarkdownSource = { name: string; text: string };
type MarkdownTask = { title: string; body: string; source: string };
type MarkdownBatch = {
  tasks: MarkdownTask[];
  order: { title: string; source: string; missing?: boolean }[];
  missing: string[];
  errors: string[];
  context: string;
};

function linesOf(text: string) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
}

function pathKey(name: string) {
  return name.replace(/\\/g, '/').replace(/(?:^|\/)\.\//g, '/').replace(/^\//, '').toLowerCase();
}

function basename(name: string) {
  return name.split(/[\\/]/).pop() || name;
}

// Only headings/links outside fences describe the document. A fenced text
// block can carry the agent prompt, including Markdown examples of its own.
function scan(lines: string[]) {
  const prose: { line: string; index: number }[] = [];
  const prompts: string[] = [];
  let fence: { marker: string; start: number; isText: boolean } | undefined;
  for (const [index, line] of lines.entries()) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (match && match[1].startsWith(fence.marker) && !match[2].trim()) {
        if (fence.isText) prompts.push(lines.slice(fence.start, index).join('\n'));
        fence = undefined;
      }
    } else if (match) {
      fence = { marker: match[1], start: index + 1, isText: /^text$/i.test(match[2].trim()) };
    } else {
      prose.push({ line, index });
    }
  }
  if (fence?.isText) prompts.push(lines.slice(fence.start).join('\n'));
  return { prose, prompts };
}

function cleanHeading(label: string) {
  return label.trim().replace(/\s+#+$/, '').trim();
}

function fileTask(file: MarkdownSource): MarkdownTask {
  const lines = linesOf(file.text);
  const { prose, prompts } = scan(lines);
  const heading = prose.find(({ line }) => /^ {0,3}#\s+\S/.test(line));
  const title = heading ? cleanHeading(heading.line.replace(/^ {0,3}#\s+/, '')) : basename(file.name).replace(/\.md$/i, '');
  const body = prompts.length ? prompts.join('\n\n') : lines.filter((_, index) => index !== heading?.index).join('\n');
  return { title, body: body.trim(), source: file.name };
}

function markdownLink(row: string) {
  // Task table cells and list items start with a link, which may have an
  // angle-bracket destination (filenames with spaces) and an optional title.
  const link = /^\s*\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/.exec(row);
  if (!link) return;
  let target = (link[1] || link[2]).split(/[?#]/, 1)[0];
  if (!target || /^[a-z][a-z\d+.-]*:|^[/\\]{1,2}/i.test(target)) return;
  try { target = decodeURIComponent(target); } catch { /* A literal % may be part of the filename. */ }
  return /\.md$/i.test(target) ? target : undefined;
}

function references(prose: ReturnType<typeof scan>['prose'], prompts: string[]) {
  const paths: string[] = [];
  for (const block of prompts) {
    for (const line of block.split('\n')) {
      // A full row is a queue entry. Inline mentions such as "skip docs.md"
      // or source files named in a sentence are never picked up here.
      const row = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?(?:`([^`]+\.md)`|([^\s`<>:"|*?]+\.md))\s*$/i.exec(line);
      if (row) paths.push(row[1] || row[2]);
    }
  }
  if (paths.length) return paths;
  const table: string[] = [], list: string[] = [];
  for (const { line } of prose) {
    const cell = /^\s*\|\s*([^|]+)\|/.exec(line);
    const item = /^\s*(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.+)$/.exec(line);
    if (cell || item) {
      const link = markdownLink((cell || item)![1]);
      if (link) (cell ? table : list).push(link);
    }
  }
  return table.length ? table : list;
}

function resolveFiles(refs: string[], children: MarkdownSource[], batch: MarkdownBatch) {
  const used = new Map<MarkdownSource, string>();
  for (const ref of new Set(refs)) {
    const key = pathKey(ref);
    const exact = children.filter(file => pathKey(file.name) === key);
    const matches = exact.length ? exact : children.filter(file => pathKey(basename(file.name)) === basename(key));
    if (!matches.length) {
      batch.missing.push(ref);
      batch.order.push({ title: ref, source: ref, missing: true });
    } else if (matches.length > 1 || (used.has(matches[0]) && used.get(matches[0]) !== key)) {
      batch.errors.push(`Ambiguous task file: ${ref}`);
      batch.order.push({ title: ref, source: ref });
    } else if (!used.has(matches[0])) {
      const task = fileTask(matches[0]);
      batch.tasks.push(task);
      batch.order.push({ title: task.title, source: ref });
      used.set(matches[0], key);
    }
  }
}

export function parseMarkdownTasks(main: MarkdownSource, children: MarkdownSource[]): MarkdownBatch {
  const lines = linesOf(main.text);
  const { prose, prompts } = scan(lines);
  const refs = references(prose, prompts);
  const batch: MarkdownBatch = { tasks: [], order: [], missing: [], errors: [], context: lines.join('\n').trim() };
  if (!batch.context) batch.errors.push(`Empty context file: ${main.name}`);
  if (refs.length) {
    resolveFiles(refs, children, batch);
  } else if (children.length) {
    resolveFiles(children.map(file => file.name), children, batch);
  } else {
    const sections = prose.filter(({ line }) => /^ {0,3}##\s+\S/.test(line));
    if (sections.length) batch.context = lines.slice(0, sections[0].index).join('\n').trim();
    for (const [i, section] of sections.entries()) {
      const title = cleanHeading(section.line.replace(/^ {0,3}##\s+/, ''));
      const body = lines.slice(section.index + 1, sections[i + 1]?.index).join('\n').trim();
      batch.tasks.push({ title, body, source: main.name });
      batch.order.push({ title, source: main.name });
    }
  }
  for (const task of batch.tasks) {
    if (!task.body) batch.errors.push(`Empty task: ${task.title}`);
  }
  if (!batch.tasks.length && !batch.errors.length && !batch.missing.length) {
    batch.errors.push('Select task files or add level-two task headings.');
  }
  if (batch.errors.length || batch.missing.length) batch.tasks = [];
  return batch;
}
