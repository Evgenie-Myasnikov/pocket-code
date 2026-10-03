import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roadmapFromChangelog} from '../server/project-roadmap.js';
test('roadmap uses recorded releases and preserves stable note identities when a newer release is added',()=>{
 const text='# Changelog\n## 2026-10-03 - Navigation (0.25.0)\n- Changed: Separate workspace invitations.\n- Release: Published v0.25.0.\n\n## 2026-10-02 - Boards (0.24.1)\n- Added: Participant avatars.\n- Follow-up: Published v0.24.1.\n';
 const initial=roadmapFromChangelog(text);assert.deepEqual(initial.versions,['0.24.1','0.25.0']);assert.ok(initial.notes.every(note=>note.status==='done'));assert.match(initial.notes[1].title,/Separate workspace/);
 const newer=roadmapFromChangelog('## 2026-10-04 - Documents (0.25.1)\n- Changed: Browse changelogs by project.\n'+text);assert.equal(newer.notes.at(-1)?.status,'review');assert.deepEqual(newer.notes.slice(0,2).map(n=>n.id),initial.notes.map(n=>n.id));
 assert.deepEqual(roadmapFromChangelog('# Empty'),{versions:[],notes:[]});
});
