import type {Block} from '../server/types';
export function toolActivity(block:Block,result?:Block,running=false){
 const name=block.name||'',status=String((block.input as Record<string,unknown>|undefined)?.status||'').toLowerCase();
 const failed=Boolean(result?.is_error)||['failed','error','declined'].includes(status);
 const active=!failed&&(['inprogress','in_progress','running'].includes(status)||(!result&&!status&&running));
 const done=Boolean(result)||['completed','complete','success'].includes(status);
 const kind=/^(command|bash|exec_command|write_stdin|shell|terminal)$/i.test(name)?'command':/^(file changes|edit|write|multiedit|apply_patch)$/i.test(name)?'edit':'tool';
 const label=failed?'Действие завершилось ошибкой':kind==='command'?active?'Выполняет команду':done?'Выполнил команду':'Команда':kind==='edit'?active?'Изменяет файлы':done?'Изменил файлы':'Изменения файлов':active?'Выполняет действие':done?'Выполнил действие':'Действие';
 return {label,kind,active,failed};
}
