import {useId,useMemo,useState,type ReactNode} from 'react';
import {ChevronRight,FileCode2} from 'lucide-react';
import {useLanguage} from './i18n';
import type {ToolView} from './tool-registry';
import {editFiles,type EditFile} from './edit-diff';
import './edit-activity.css';

const signs={add:'+',del:'-',context:' ',meta:''};
const lineForms:Record<string,string>={one:'строка',few:'строки',many:'строк',other:'строк'};
const ruPlural=new Intl.PluralRules('ru');
function diffText(file:EditFile){return file.content??file.lines.map(row=>signs[row.kind]+row.text).join('\n');}

export function EditActivity({view,input,name,result,copy,fallback,created=false}:{
  view:ToolView;input:Record<string,unknown>;name:string;result?:ReactNode;
  copy:(text:string,label:string)=>ReactNode;fallback?:ReactNode;created?:boolean;
}){
  const ru=useLanguage()==='ru',l=(en:string,rs:string)=>ru?rs:en;
  const [open,setOpen]=useState(false),titleId=useId(),infoId=useId();
  const files=useMemo(()=>editFiles(input,name,created),[input,name,created]);
  const path=files[0]?.path||view.files[0]||'',short=path.split(/[\\/]/).at(-1)||'';
  const writing=name==='write'||name==='create'||input.command==='create';
  const status=result&&view.status==='running'?'done':view.status;
  const running=status==='running',failed=status==='failed',denied=status==='denied';
  const label=running?(writing?l('Writing file','Записываю файл'):l('Editing file','Изменяю файл')):
    failed?l('File change failed','Ошибка изменения файла'):denied?l('File change declined','Изменение отклонено'):
    view.done&&view.status!=='running'?view.title:status==='done'?l('File change completed','Изменение завершено'):writing?l('File write','Запись файла'):l('File change','Изменение файла');
  const target=files.length>1?short+' +'+(files.length-1):short;
  const title=view.done&&view.status==='done'?label:[label,target].filter(Boolean).join(' · ');
  const source=files.length===1?files[0].content:undefined;
  const preview=running?(source??(typeof input.new_string==='string'?input.new_string:typeof input.patch==='string'?input.patch:undefined)):undefined;
  const currentText=preview??source;
  const measured=useMemo(()=>{
    if(currentText===undefined)return;
    const lines=currentText.split(/\r?\n/);
    if(lines.at(-1)==='')lines.pop();
    return {bytes:new TextEncoder().encode(currentText).length,count:lines.length,tail:lines.slice(-4).join('\n')};
  },[currentText]);
  const bytes=typeof input.preview_bytes==='number'?input.preview_bytes:measured?.bytes;
  const diffKnown=files.length>0&&files.every(file=>file.counted);
  let added=0,removed=0;
  for(const file of files)for(const row of file.lines){if(row.kind==='add')added++;if(row.kind==='del')removed++;}
  const showCounts=diffKnown&&(added>0||removed>0);
  const count=typeof input.preview_lines==='number'?input.preview_lines:measured?.count??0;
  const truncated=input.preview_truncated===true;
  const bytesText=bytes!==undefined?(bytes<1024?bytes+l(' B',' Б'):(bytes/1024).toLocaleString(ru?'ru':'en',{maximumFractionDigits:1})+l(' KiB',' КиБ')):'';
  const countText=count+' '+(ru?lineForms[ruPlural.select(count)]:count===1?'line':'lines');
  return <details className={'tool-card activity-row edit-activity'+(result?' combined':'')+(failed||denied?' failed':'')} data-status={status} onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary aria-labelledby={titleId} aria-describedby={infoId}>
      <span className="edit-summary-line">
        <ChevronRight aria-hidden="true" size={14} className="edit-chevron"/>
        <span className="tool-title" id={titleId} title={path||title}>{title}</span>
        <span className="edit-metrics" id={infoId}>
          {showCounts&&!truncated&&(!running||!writing)&&<span className="tool-diffstat" aria-label={ru?'Добавлено '+added+', удалено '+removed:'Added '+added+', removed '+removed}><b>+{added}</b><i>−{removed}</i></span>}
          {bytes!==undefined&&<span title={bytes+l(' bytes',' байт')}>{truncated&&(input.preview_bytes===undefined||input.preview_lines===undefined)?l('Excerpt · ','Фрагмент · '):''}{bytesText} · {countText}</span>}
          {running&&<><i className="edit-live-dot" aria-hidden="true"/><span className="visually-hidden">{l('In progress','Выполняется')}</span></>}
        </span>
      </span>
      {preview&&<span className="edit-live-snippet" aria-hidden="true">{measured?.tail}</span>}
    </summary>
    {open&&<div className="edit-expanded">
      {truncated&&<small>{l('Showing the latest received part','Показана последняя полученная часть')}</small>}
      {files.map((file,index)=><section className="edit-file" key={index}>
        {(file.path||file.lines.length>0)&&<header>
          <FileCode2 size={14} aria-hidden="true"/><span>{file.path||l('File','Файл')}</span>
          {file.lines.length>0&&copy(diffText(file),truncated?l('Copy excerpt','Копировать фрагмент'):file.content!==undefined?l('Copy code','Копировать код'):l('Copy diff','Копировать изменения'))}
        </header>}
        {file.lines.length>0&&<pre className="tool-diff edit-diff" tabIndex={0} aria-label={file.path||l('Changes','Изменения')}>
          {file.lines.slice(0,2000).map((row,i)=><span className="edit-source-line" data-line={row.kind} key={i}><span className="edit-sign" aria-hidden="true">{signs[row.kind]}</span><code>{row.text}</code>{'\n'}</span>)}
          {file.lines.length>2000&&<span data-line="meta">{l('More lines','Ещё строк')} · {file.lines.length-2000}</span>}
        </pre>}
      </section>)}
      {!files.some(file=>file.lines.length||file.content!==undefined)&&fallback}
      {result}
    </div>}
  </details>;
}
