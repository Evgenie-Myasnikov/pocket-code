import { RichBlock } from './RichBlocks';
import { t } from "./i18n";import { useState } from 'react';
import { Copy, Check, Terminal, ShieldCheck, X, ChevronDown } from 'lucide-react';
import type { ChatMessage, Approval } from '../server/types';
function CopyButton({ text }: {text: string;}) {
  const [copied, setCopied] = useState(false);
  return <button className="icon-button copy-button" aria-label={t("Копировать")} onClick={async () => {try {await navigator.clipboard.writeText(text);setCopied(true);setTimeout(() => setCopied(false), 1500);} catch {setCopied(false);}}}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>;
}
export function Message({ message, provider = 'claude' }: {message: ChatMessage;provider?: 'claude' | 'codex';}) {
  const plain = message.blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const toolOnly = message.blocks.every((b) => b.type === 'tool_result');
  return <article className={`message ${message.role} ${toolOnly ? 'tool-result' : ''}`}>
    {!toolOnly && <div className="message-label">{message.role === 'assistant' ? <><span className="claude-mark">{provider === 'codex' ? '⌘' : '✳'}</span> {provider.toUpperCase()}</> : message.role === 'user' ? t("ВЫ") : t("СИСТЕМА")}{plain && <CopyButton text={plain} />}</div>}
    {message.blocks.map((block,i) => <RichBlock key={i} block={block}/>)}
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
