import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdownTasks, type MarkdownSource } from '../src/markdown-task-batch';

const file = (name: string, text: string): MarkdownSource => ({ name, text });
const first = file('first.md', '# First\r\n\r\nPurpose for readers.\r\n\r\n```text\r\nWork first.\r\n```');
const second = file('second.md', '# Second\n\nWork second.');

test('a fenced runner uses whole path rows in declared order', () => {
  const runner = file('plan.md', '# Plan\n~~~text\nQueue:\n  tasks/second.md\n  tasks/first.md\nSkip tasks/other.md.\n~~~');
  const batch = parseMarkdownTasks(runner, [first, second]);
  assert.deepEqual(batch.errors, []);
  assert.deepEqual(batch.missing, []);
  assert.deepEqual(batch.tasks, [
    { title: 'Second', source: 'second.md', body: 'Work second.' },
    { title: 'First', source: 'first.md', body: 'Work first.' },
  ]);
  assert.equal(batch.context, runner.text);
});

test('a task table preserves row order across sections and skips prose and setup links', () => {
  const index = file('index.md', [
    '# Tasks', '- [Guide](guide.md)', '## Part A', '| File | Description |', '|---|---|',
    '| [Second](second.md) | See [spec](spec.md) |', '## Part B',
    '| File | Description |', '|---|---|', '| [First](./first.md) | Task |',
    '[Runner](runner.md) — alternative workflow',
  ].join('\n'));
  const batch = parseMarkdownTasks(index, [first, second]);
  assert.deepEqual(batch.tasks.map(task => task.title), ['Second', 'First']);
  assert.deepEqual(batch.missing, []);
});

test('explicit lists support spaces, optional titles, and fragments', () => {
  const batch = parseMarkdownTasks(file('index.md', '1. [First](<Task One.md> "start")\n- [Second](second.md#notes)\n- [Docs](https://example.org/help.md)'),
    [file('Task One.md', 'No heading.'), second]);
  assert.deepEqual(batch.tasks.map(task => task.title), ['Task One', 'Second']);
});

test('unresolved references preserve the whole declared preview order and prevent a partial batch', () => {
  const batch = parseMarkdownTasks(file('plan.md', '- [First](tasks/first.md)\n- [Next](next.md)\n- [Second](second.md)'), [second, first]);
  assert.deepEqual(batch.missing, ['next.md']);
  assert.deepEqual(batch.order, [
    { title: 'First', source: 'tasks/first.md' },
    { title: 'next.md', source: 'next.md', missing: true },
    { title: 'Second', source: 'second.md' },
  ]);
  assert.deepEqual(batch.tasks, []);
});

test('one basename does not silently satisfy two distinct references', () => {
  const batch = parseMarkdownTasks(file('plan.md', '- [A](a/first.md)\n- [B](b/first.md)'), [first]);
  assert.match(batch.errors.join('\n'), /Ambiguous.*b\/first.md/);
  assert.deepEqual(batch.tasks, []);
});

test('a duplicate selected filename blocks import; full paths disambiguate', () => {
  const main = file('index.md', '# Plan\n- [Task](first.md)');
  assert.match(parseMarkdownTasks(main, [first, first]).errors[0], /Ambiguous/);
  const qualified = file('index.md', '# Plan\n- [Task](sub/first.md)');
  assert.equal(parseMarkdownTasks(qualified, [file('sub/first.md', 'One'), file('other/first.md', 'Two')]).tasks[0].body, 'One');
});

test('project-bound Markdown links resolve relative to their context and never match unrelated same-name files',()=>{
  const main={name:'plans/phase/index.md',projectPath:'plans/phase/index.md',text:'- [Read](../steps/one.md)'};
  const right={name:'plans/steps/one.md',projectPath:'plans/steps/one.md',text:'Right task.'};
  const other={name:'archive/steps/one.md',projectPath:'archive/steps/one.md',text:'Other task.'};
  assert.deepEqual(parseMarkdownTasks(main,[other]).missing,['../steps/one.md']);
  assert.equal(parseMarkdownTasks(main,[other,right]).tasks[0].source,right.projectPath);
  const upload=parseMarkdownTasks(main,[file('one.md','Uploaded task.')]);
  assert.equal(upload.tasks[0].source,'one.md');
});

test('a generic context with selected task files keeps the selection order', () => {
  assert.deepEqual(parseMarkdownTasks(file('context.md', '# Context\nFollow the guide.'), [second, first]).tasks.map(task => task.title), ['Second', 'First']);
});

test('a single file shares its preamble and keeps nested headings and fenced examples inside the task', () => {
  const batch = parseMarkdownTasks(file('plan.md', [
    '# Main', 'Shared instructions.', '## One ##', 'First task', '#### Detail', '~~~~md', '## Example', '~~~~', '## Two', 'Second task',
  ].join('\n')), []);
  assert.equal(batch.context, '# Main\nShared instructions.');
  assert.deepEqual(batch.tasks.map(task => task.title), ['One', 'Two']);
  assert.equal(batch.tasks[0].body, 'First task\n#### Detail\n~~~~md\n## Example\n~~~~');
  assert.equal(batch.tasks[1].body, 'Second task');
});

test('empty input or a task without instructions prevents starting the batch', () => {
  for (const [main, selected] of [
    [file('empty.md', ' '), [first]], [file('index.md', 'General notes'), []],
    [file('plan.md', '# Plan\n## One\n## Two\nDo work.'), []], [file('context.md', 'Work'), [file('one.md', '# Empty')]],
  ] as [MarkdownSource, MarkdownSource[]][]) {
    const batch = parseMarkdownTasks(main, selected);
    assert.ok(batch.errors.length);
    assert.deepEqual(batch.tasks, []);
  }
});
