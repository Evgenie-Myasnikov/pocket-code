import {test} from 'node:test';
import assert from 'node:assert/strict';
import {miroLink} from '../src/miro-link.js';
test('Miro URLs keep only a canonical board ID and use the full interface',()=>{
 const result=miroLink('https://miro.com/app/board/synthetic_123=/?share_link_id=secret&boardsAccessToken=secret#selection');
 assert.equal(result.url,'https://miro.com/app/board/synthetic_123=/');
 assert.equal(result.embedUrl,'https://miro.com/app/live-embed/synthetic_123=/?autoplay=true&usePostAuth=true');
 assert.equal(miroLink(result.embedUrl).boardId,result.boardId);
});
test('Miro URL validation rejects local, credentialed and lookalike destinations',()=>{
 for(const value of ['http://miro.com/app/board/synthetic/','https://miro.com.evil.invalid/app/board/synthetic/','https://user:password@miro.com/app/board/synthetic/','https://miro.com:444/app/board/synthetic/','https://miro.com/app/board/synthetic/extra','javascript:alert(1)','https://localhost/app/board/synthetic/','https://miro.com/app/board/%2fsecret/'])assert.throws(()=>miroLink(value));
});
