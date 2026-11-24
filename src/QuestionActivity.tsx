import {Check} from 'lucide-react';
import type {Block} from '../server/types';
import {t} from './i18n';
import {toolText} from './tool-registry';
import './question-activity.css';

type Option={label:string;description?:string};
type Question={question:string;header?:string;options:Option[]};

const str=(value:unknown)=>typeof value==='string'?value:'';
function questionsOf(input:Record<string,unknown>):Question[]{
  const list=Array.isArray(input.questions)?input.questions:[];
  return list.flatMap(item=>{
    if(!item||typeof item!=='object')return [];
    const value=item as Record<string,unknown>,question=str(value.question)||str(value.prompt);
    if(!question)return [];
    const options=(Array.isArray(value.options)?value.options:[]).flatMap(option=>typeof option==='string'?[{label:option}]:option&&typeof option==='object'&&str((option as Record<string,unknown>).label)?[{label:str((option as Record<string,unknown>).label),description:str((option as Record<string,unknown>).description)||undefined}]:[]);
    return [{question,header:str(value.header)||undefined,options}];
  });
}

/**
 * The answers a provider reports back: an `answers` map on the tool input, the SDK's `"question"="answer"` pairs,
 * or a single quoted answer after "answered:". The provider's instructions to itself around them are not shown.
 */
export function answersOf(input:Record<string,unknown>,result:Block|undefined,questions:Question[]):Map<string,string>{
  const answers=new Map<string,string>();
  if(input.answers&&typeof input.answers==='object')for(const [key,value] of Object.entries(input.answers as Record<string,unknown>))if(typeof value==='string')answers.set(key,value);
  if(answers.size||!result)return answers;
  const text=toolText(result.content);
  for(const match of text.matchAll(/"((?:[^"\\]|\\.)+)"\s*=\s*"((?:[^"\\]|\\.)*)"/g))answers.set(match[1],match[2]);
  if(!answers.size&&questions.length===1){
    const single=/answered[^:]*:\s*"([\s\S]*?)"\s*\.\s/i.exec(text)||/answered[^:]*:\s*"([\s\S]*)"/i.exec(text);
    if(single)answers.set(questions[0].question,single[1]);
  }
  return answers;
}

/** A question the agent asked, shown as the person saw it: the question, its choices, and the answer they gave. */
export function QuestionActivity({input,result}:{input:Record<string,unknown>;result?:Block}){
  const questions=questionsOf(input);
  if(!questions.length)return null;
  const answers=answersOf(input,result,questions),declined=!!result?.is_error;
  return <div className="question-activity">{questions.map((question,index)=>{
    const answer=answers.get(question.question);
    const chosen=new Set((answer||'').split(/,\s*/).filter(Boolean));
    return <section key={index} className="question-activity-item">
      {question.header&&<span className="question-activity-header">{question.header}</span>}
      <p className="question-activity-text">{question.question}</p>
      {question.options.length>0&&<ul className="question-activity-options">{question.options.map(option=><li key={option.label} data-chosen={chosen.has(option.label)||undefined}>
        <span className="question-activity-mark" aria-hidden="true">{chosen.has(option.label)&&<Check size={13}/>}</span>
        <span><strong>{option.label}</strong>{option.description&&<small>{option.description}</small>}</span>
      </li>)}</ul>}
      {answer!==undefined?<p className="question-activity-answer"><span>{t('Ответ')}</span>{answer||t('без ответа')}</p>
        :result&&<p className="question-activity-answer" data-declined={declined||undefined}><span>{t('Ответ')}</span>{declined?t('Вопрос отклонён'):t('без ответа')}</p>}
    </section>;
  })}</div>;
}
