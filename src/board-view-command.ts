import type {BoardViewState,ViewCommand} from '../server/board-view-control';
export function viewCommandApplied(command:ViewCommand,state:BoardViewState){
 if(!state.visible||state.busy||state.revision!==command.revision)return false;
 const action=command.action;
 if(action.type==='follow')return state.following===action.enabled;
 if(action.type==='select')return state.selected.length===new Set(action.ids).size&&action.ids.every(id=>state.selected.includes(id));
 if(action.type==='focus')return action.ids.every(id=>state.inView.includes(id));
 if(action.type==='camera')return Math.abs(state.zoom-action.zoom)<.001&&Math.abs((state.width/2-state.pan.x)/state.zoom-action.x)<1&&Math.abs((state.height/2-state.pan.y)/state.zoom-action.y)<1;
 return true;
}
