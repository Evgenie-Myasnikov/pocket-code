import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toolActivity} from '../src/tool-activity.js';
test('activity labels distinguish running, completed, failed and unknown historical states',()=>{
 assert.equal(toolActivity({type:'tool_use',name:'Command',input:{status:'inProgress'}}).label,'Выполняет команду');
 assert.equal(toolActivity({type:'tool_use',name:'Bash'},{type:'tool_result',content:'ok'},true).label,'Выполнил команду');
 assert.equal(toolActivity({type:'tool_use',name:'File changes',input:{status:'completed'}}).label,'Изменил файлы');
 assert.equal(toolActivity({type:'tool_use',name:'Command'}).label,'Команда');
 assert.equal(toolActivity({type:'tool_use',name:'Bash'},{type:'tool_result',is_error:true}).label,'Действие завершилось ошибкой');
});
