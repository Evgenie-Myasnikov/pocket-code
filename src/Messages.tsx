import { RichBlock } from './RichBlocks';
import { t } from "./i18n";import { useState } from 'react';
import { Copy, Check, ShieldCheck, X } from 'lucide-react';
import type { ChatMessage, Approval, SubagentView, Block } from '../server/types';
import './messages.css';
function CopyButton({ text }: {text: string;}) {
  const [copied, setCopied] = useState(false);
  return <button className="icon-button copy-button" aria-label={t("Копировать")} onClick={async () => {try {await navigator.clipboard.writeText(text);setCopied(true);setTimeout(() => setCopied(false), 1500);} catch {setCopied(false);}}}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>;
}
export function Message({ message, provider = 'claude', onSubagent, agents,toolResults,running=false }: {message: ChatMessage;provider?: 'claude' | 'codex';onSubagent?(agent:SubagentView):void;agents?:Map<string,SubagentView>;toolResults?:Map<string,Block>;running?:boolean}) {
  const plain = message.blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  if(message.blocks.length&&message.blocks.every(b=>b.type==='tool_result'&&b.tool_use_id&&toolResults?.has(b.tool_use_id)))return null;
  const isUser = message.role === 'user';
  const toolOnly = !isUser && message.blocks.length > 0 && message.blocks.every((b) => ['tool_result','tool_use','thinking','codexItem','subagent'].includes(b.type));
  const content = message.blocks.map((block,i) => {
      if(block.type==='tool_result'&&block.tool_use_id&&toolResults?.has(block.tool_use_id))return null;
      const previous=message.blocks[i-1],next=message.blocks[i+1];
      // Keep a call and its adjacent matching result in one disclosure. Unknown
      // or separate results remain visible; no content is discarded or reordered.
      if(block.type==='tool_result' && previous?.type==='tool_use' && previous.id && previous.id===block.tool_use_id)return null;
      const result=block.type==='tool_use' && block.id ? toolResults?.get(block.id)||(next?.type==='tool_result'&&next.tool_use_id===block.id?next:undefined):undefined;
      return <RichBlock key={i} running={running} block={block.agent && agents?.has(block.agent.id)?{...block,agent:agents.get(block.agent.id)}:block} result={result} onSubagent={onSubagent}/>;
    });
  return <article data-message-id={message.id} aria-label={isUser?t("ВЫ"):undefined} className={`message ${message.role} ${toolOnly ? 'tool-result' : ''}`}>
    {isUser ? <>{plain && <CopyButton text={plain}/>}<div className="user-message-content">{content}</div></> : <>
      {!toolOnly && <div className="message-label">{message.role === 'assistant' ? <><span className="claude-mark">{provider === 'codex' ? '⌘' : '✳'}</span> {provider.toUpperCase()}</> : t("СИСТЕМА")}{plain && <CopyButton text={plain} />}</div>}
      {content}
    </>}
  </article>;
}
export function ApprovalCard({ approval, decide, provider = 'claude' }: {approval: Approval;provider?: 'claude' | 'codex';decide: (allow: boolean, answers?: Record<string, string>) => Promise<void>;}) {
  const [answers, setAnswers] = useState<Record<string, string>>({}),[busy, setBusy] = useState(false),[error, setError] = useState('');
  const questions = approval.tool === 'AskUserQuestion' && Array.isArray(approval.input.questions) ? approval.input.questions as Array<{question: string;options?: {label: string;description?: string;}[];}> : [];
  async function submit(allow: boolean) {setBusy(true);setError('');try {await decide(allow, answers);} catch (e) {setError((e as Error).message);} finally {setBusy(false);}}
  return <section className="approval-card"><div className="eyebrow"><ShieldCheck size={15} />{t(" НУЖНО ВАШЕ РЕШЕНИЕ")}</div><h3>{questions.length ? t("{0} уточняет", provider === 'codex' ? 'Codex' : 'Claude') : t("Разрешить {0}?", approval.tool)}</h3>
    {questions.length ? questions.map((q) => <label key={q.question}>{q.question}<div className="answer-options">{q.options?.map((o) => <button title={o.description} className={answers[q.question] === o.label ? 'selected' : ''} key={o.label} onClick={() => setAnswers({ ...answers, [q.question]: o.label })}>{o.label}</button>)}</div><input placeholder={t("Ваш ответ")} value={answers[q.question] || ''} onChange={(e) => setAnswers({ ...answers, [q.question]: e.target.value })} /></label>) : <pre>{JSON.stringify(approval.input, null, 2)}</pre>}
    <p>{t("Разрешение только на это действие · ожидание до 10 минут")}</p>{error && <div className="error">{t(error)}</div>}
    <div className="approval-actions"><button className="secondary" disabled={busy} onClick={() => submit(false)}><X size={16} />{t("Отклонить")}</button><button className="primary" disabled={busy || questions.length > 0 && questions.some((q) => !answers[q.question]?.trim())} onClick={() => submit(true)}><Check size={16} />{questions.length ? t("Ответить") : t("Разрешить")}</button></div>
  </section>;
}
