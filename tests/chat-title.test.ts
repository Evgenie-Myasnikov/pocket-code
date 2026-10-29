import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chatTitle} from '../src/chat-title';
test('generated titles remove upload metadata and retain the actual request',()=>{
 assert.equal(chatTitle('Build a tree\n\nFiles attached by the user (read these local files as needed):\n"C:\\Demo\\Board context.txt"','New chat'),'Build a tree');
 assert.equal(chatTitle(': "C:\\Demo\\Board context.txt"','Board discussion'),'Board discussion');
 assert.equal(chatTitle(undefined,'New chat'),'New chat');
 assert.equal(chatTitle('A normal title','New chat'),'A normal title');
});
