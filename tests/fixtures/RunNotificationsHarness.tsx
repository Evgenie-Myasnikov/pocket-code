import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {setRunAlerts,useDesktopRunNotifications,useRunAlertsPreference,type WatchedChat} from '../../src/chat-notifications';
const connection={url:'http://127.0.0.1:4318',token:'',desktop:true};
function Harness(){
  const [connected,setConnected]=useState(true),[section,setSection]=useState('board'),[opened,setOpened]=useState<WatchedChat|null>(null);
  const alerts=useRunAlertsPreference();
  useDesktopRunNotifications(connected?connection:null,'en',chat=>{setOpened(chat);setSection('chat');});
  return <><button onClick={()=>setConnected(!connected)}>{connected?'Disconnect':'Reconnect'}</button><button onClick={()=>setSection('settings')}>Settings</button><label><input type="checkbox" checked={alerts} onChange={event=>setRunAlerts(event.target.checked)}/>Run notifications</label><output data-testid="section">{section}</output><output data-testid="target">{JSON.stringify(opened)}</output></>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
