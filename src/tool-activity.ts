import type {Block} from '../server/types';
import {describeTool} from './tool-registry';
/** Compatibility view of the tool registry: a translated label, a grouping kind and an explicit state. */
export function toolActivity(block:Block,result?:Block,running=false){
 const view=describeTool(block,result,running);
 return {...view,label:view.title};
}
