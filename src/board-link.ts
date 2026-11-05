import {request,type Connection} from './api';
import type {ProjectBoard} from '../server/boards';
import type {BoardLink} from './session';

/** Load the board a chat is linked to: a host board by ID, otherwise the project's repository board with that ID. */
export async function loadLinkedBoard(connection:Connection,link:BoardLink):Promise<ProjectBoard>{
  try{return await request<ProjectBoard>(connection,'/boards/'+encodeURIComponent(link.id));}
  catch(error){
    if((error as {status?:number}).status!==404)throw error;
    const repository=await request<{board:ProjectBoard|null}>(connection,'/project-board?root='+encodeURIComponent(link.root));
    if(repository.board?.id!==link.id)throw Object.assign(Error('Board not found'),{status:404});
    return repository.board;
  }
}
