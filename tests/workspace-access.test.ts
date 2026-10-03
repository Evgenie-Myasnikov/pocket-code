import {test} from 'node:test';
import assert from 'node:assert/strict';
import {savedWorkspaces,rememberWorkspace} from '../src/workspace-access';
test('saved workspace credentials do not recursively embed the connection vault',()=>{
 const access={url:'https://example.invalid',token:'synthetic',workspaceId:'atlas',name:'Atlas'};
 let connection:any={...access,workspaceOnly:true,workspaceAccesses:[access]};
 for(let i=0;i<10;i++)connection={...connection,workspaceAccesses:savedWorkspaces(connection)};
 assert.equal(connection.workspaceAccesses.length,1);assert.equal(connection.workspaceAccesses[0].workspaceAccesses,undefined);
 assert.equal(JSON.stringify(connection).length<500,true);
 assert.equal(rememberWorkspace(connection.workspaceAccesses,{...access,token:'replacement'}).length,1);
});
