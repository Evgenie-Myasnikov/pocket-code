import {spawn,type ChildProcess} from 'node:child_process';
import {discoverCodex} from './codex-rpc.js';

export class JiraLogin {
  private child?:ChildProcess;
  private timer?:ReturnType<typeof setTimeout>;
  private state:'idle'|'waiting'|'checking'|'connected'|'error'='idle';
  private message='';
  private closed=false;
  constructor(private verify:()=>Promise<boolean>,private executable=discoverCodex,private launch=spawn){}
  status(){return {state:this.state,message:this.message};}
  async start(){
    if(this.closed)throw Error('The PC server is stopping.');
    if(this.state==='waiting'||this.state==='checking')return this.status();
    this.state='waiting';this.message='Complete Atlassian sign-in in the browser on this PC. If approval is required, contact your site administrator.';
    try{
      const executable=await this.executable();
      if(this.closed)return this.status();
      const child=this.launch(executable,['mcp','login','jira'],{windowsHide:true,shell:false,stdio:'ignore'});this.child=child;
      const fail=()=>{if(this.child!==child)return;clearTimeout(this.timer);this.child=undefined;this.state='error';this.message='Sign-in did not complete. Retry, or check Atlassian approval in the browser. Claude authorization does not sign Codex in.';};
      child.once('error',fail);
      child.once('exit',code=>{
        if(this.child!==child)return;
        if(code!==0){fail();return;}
        clearTimeout(this.timer);this.child=undefined;this.state='checking';this.message='Checking Jira access…';
        void this.verify().then(ok=>{if(this.closed)return;this.state=ok?'connected':'error';this.message=ok?'Jira is connected to Codex. Retry the connection on your phone.':'Sign-in completed, but Jira tools are unavailable. Check access to the Atlassian site.';}).catch(()=>{if(!this.closed){this.state='error';this.message='Could not verify Jira access. Retry the connection.';}});
      });
      this.timer=setTimeout(()=>{fail();child.kill();},300000);this.timer.unref();
    }catch{this.state='error';this.message='Could not start Codex sign-in. Check that Codex is installed on this PC.';}
    return this.status();
  }
  close(){this.closed=true;clearTimeout(this.timer);this.child?.kill();this.child=undefined;}
}

export const jiraLoginPage=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Jira · Pocket Code</title><style>body{background:#111512;color:#e1e9d9;font:17px system-ui;max-width:640px;margin:40px auto;padding:24px;line-height:1.6}button{font:inherit;background:#c3dda8;color:#172111;border:0;border-radius:12px;padding:12px 18px;cursor:pointer;margin:6px 6px 6px 0}button:disabled{opacity:.5}p{color:#b6c3ae}section{border-top:1px solid #384532;margin-top:24px;padding-top:12px}h2{font-size:20px}</style><h1>Подключения · Jira</h1><p>Одно подключение Jira для всех задач. AI для работы над задачей выбирается отдельно — Claude или Codex.</p><p id="selected"></p><section><h2>Существующее подключение Claude</h2><p>Использует ваш Atlassian MCP в Claude. Запросы проходят через Claude и расходуют его лимиты.</p><button id="claude">Использовать подключение Claude</button></section><section><h2>Прямое подключение MCP</h2><p>Авторизация хранится в Codex на этом ПК. Запросы Jira выполняются без обращения к модели, в том числе для задач Claude.</p><button id="login">Войти в Atlassian</button><button id="codex">Использовать прямое подключение</button><p>Если Atlassian требует разрешение администратора сайта, сначала потребуется его одобрение. Вход Claude не заменяет этот вход.</p></section><p id="status" role="status"></p><script>
const token=decodeURIComponent(location.hash.slice(1));history.replaceState(null,'',location.pathname);
const button=document.getElementById('login'),status=document.getElementById('status'),selected=document.getElementById('selected');let timer;
async function request(path,method,body){const response=await fetch('/api/jira/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw Error(value.error||'Не удалось связаться с ПК. Откройте вход заново из окна QR.');return value;}
function show(value){selected.textContent='Подключение для всех AI: '+(value.source==='codex'?'прямой MCP':'Claude');status.textContent=value.message||'Выберите подключение и проверьте доступ.';button.disabled=value.state==='waiting'||value.state==='checking';clearTimeout(timer);if(button.disabled)timer=setTimeout(poll,1500);}
async function poll(){try{show(await request('pc-login','GET'));}catch(e){status.textContent=e.message;button.disabled=false;}}
button.onclick=async()=>{button.disabled=true;try{show(await request('pc-login','POST'));}catch(e){status.textContent=e.message;button.disabled=false;}};
for(const source of ['claude','codex'])document.getElementById(source).onclick=async()=>{const buttons=[...document.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);status.textContent='Проверяем доступ к Jira…';try{await request('pc-source','POST',{source});selected.textContent='Подключение для всех AI: '+(source==='codex'?'прямой MCP':'Claude');status.textContent='Jira подключена. На телефоне обновите раздел задач.';}catch(e){status.textContent=e.message;}finally{buttons.forEach(b=>b.disabled=false);}};poll();
</script></html>`;
