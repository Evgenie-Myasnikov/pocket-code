// Codex thread/sample counts UTF-8 bytes in the prompt, including JSON quoting.
export const CODEX_TASK_TEXT_BYTES = 4000;
export function taskTextSource(value:string, context:string) {
  return JSON.stringify({currentField:value, brief:context});
}
export function codexTaskTextBytes(value:string, context:string) {
  return new TextEncoder().encode(taskTextSource(value,context)).byteLength;
}
