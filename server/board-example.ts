import {randomUUID} from 'node:crypto';
import type {BoardNote} from './boards.js';
export function boardExample(language:'en'|'ru'='en'){
 const ru=language==='ru';
 const items:[BoardNote['status'],number,number,string,string,string,string][]=[
  ['idea',0,92,'Explore a useful improvement','Describe the problem and who it helps. Ask AI to clarify the idea.','Найти полезное улучшение','Опишите проблему и кому это поможет. Попросите AI уточнить идею.'],
  ['questions',1,92,'Clarify the hypothesis','Define the user, expected benefit and measurable acceptance criteria.','Уточнить гипотезу','Определите пользователя, ожидаемую пользу и измеримые критерии готовности.'],
  ['done',1,412,'Collect initial evidence','Record what has been checked and link the supporting results.','Собрать первые подтверждения','Запишите результаты проверки и добавьте ссылки на материалы.'],
  ['ready',2,92,'Prepare a small prototype','Agree on scope and what the prototype must demonstrate.','Подготовить небольшой прототип','Согласуйте объём работы и что должен показать прототип.'],
  ['working',2,412,'Implement and validate','Develop the agreed solution and check it against the acceptance criteria.','Реализовать и проверить','Разработайте согласованное решение и проверьте критерии готовности.'],
  ['review',3,92,'Review the release candidate','Ask the responsible person to review the result before release.','Проверить кандидата в релиз','Перед выпуском передайте результат ответственному человеку на проверку.'],
 ];
 const versions=['0.1','0.2','1.0'];
 return {versions,notes:items.map(([status,column,y,title,description,titleRu,descriptionRu]):BoardNote=>({id:randomUUID(),title:ru?titleRu:title,description:ru?descriptionRu:description,branch:column?versions[column-1]:'',status,owner:'',assigneeIds:[],priority:status==='working'?'high':'normal',x:column*340+20,y,dependencies:[]}))};
}
export function pocketCodeExample(){
 const example=boardExample();const titles=['Autonomous idea pipeline','Workspace entry and identity','Offline board reading','People and task assignment','Desktop canvas navigation','Separate Connection and WorkSpace QR'];
 return {...example,notes:example.notes.map((note,i)=>({...note,title:titles[i],description:'Illustrative Pocket Code roadmap. Replace this example with your own acceptance criteria and verify its status.'}))};
}
