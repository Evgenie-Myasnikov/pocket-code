import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {english} from '../src/translations';
import {setLanguage,t} from '../src/i18n';

// Every literal Russian key passed to t() needs an English value; otherwise the English UI shows Cyrillic.
const keys=new Set(Object.keys(english).map(key=>key.trim()));
function literalKeys(source:string){
  const found:string[]=[];
  for(const match of source.matchAll(/\bt\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g))found.push(match[2].replace(/\\(['"\\])/g,'$1').trim());
  return found.filter(key=>/[А-Яа-яЁё]/.test(key));
}
test('every Russian t() key in the UI has an English translation',()=>{
  const missing=readdirSync('src').filter(file=>/\.tsx?$/.test(file)&&file!=='translations.ts').flatMap(file=>literalKeys(readFileSync('src/'+file,'utf8')).filter(key=>!keys.has(key)).map(key=>`${file}: ${key}`));
  assert.deepEqual([...new Set(missing)],[]);
});
test('settings screens do not branch on the language for their own text',()=>{
  const files=['SettingsPanel.tsx','DesktopSettings.tsx','ClaudeAccessSettings.tsx','CodexAccessSettings.tsx','ProviderConnections.tsx','EngineUpdates.tsx','DesktopUpdates.tsx','MiroSettings.tsx','MiroAISettings.tsx','Updates.tsx','UsageIndicator.tsx','CodexUsage.tsx','BudgetSettings.tsx','Appearance.tsx','StreamSpeedSettings.tsx','EdgeFadeSettings.tsx','BoardGridSettings.tsx','LimitAlert.tsx'];
  for(const file of files){const source=readFileSync('src/'+file,'utf8');assert.doesNotMatch(source,/\bru\?\s*['"`]|\bl\(\s*'|=\s*\(en:string/,file);}
});
test('settings strings render in English without Cyrillic',()=>{
  setLanguage('en');
  for(const key of ['Разрешать изменения файлов','Подтверждать за меня','Полный доступ','Запрашивать подтверждение','Назад','Все настройки','Аккаунты AI','Доступ агента','Лимит стоимости одного запроса','Ближе всего к лимиту','Сменить аккаунт'])assert.doesNotMatch(t(key),/[А-Яа-яЁё]/,key);
  assert.equal(t('Сброс через {0} · {1}','1 h 48 min','today at 00:55'),'Resets in 1 h 48 min · today at 00:55');
});
test('connection and update screens use t() for text and codes from native shells',()=>{
  // Inline locale ternaries bypass the catalog, and native shells must not send prose the window shows as is.
  for(const file of ['App.tsx','ConnectionStatus.tsx','project-workspaces.tsx','RepositoryBoards.tsx','DesktopUpdates.tsx','Updates.tsx','desktop-bridge.ts','DesktopApp.tsx']){const source=readFileSync('src/'+file,'utf8');assert.doesNotMatch(source,/startsWith\('ru'\)\?\s*'(?!ru')/,file);}
  assert.doesNotMatch(readFileSync('src/project-workspaces.tsx','utf8'),/Error\('[A-Z]/);
  assert.doesNotMatch(readFileSync('src/DesktopApp.tsx','utf8'),/hostStatuses/);
  setLanguage('en');for(const key of ['ПК не отвечает','Туннель на связи, сервер ПК — нет','Нет связи с ПК · черновик сохранится','Этот чат ещё не сохранён на телефоне. Он загрузится, когда ПК будет доступен.'])assert.doesNotMatch(t(key),/[А-Яа-яЁё]/,key);
  assert.equal(t('Обновите сервер на ПК, чтобы включить {0}.','Copilot'),'Update the PC host to enable Copilot.');
});
