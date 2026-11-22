import test from 'node:test';
import assert from 'node:assert/strict';
import {filterProjectFolders,projectFolderTree} from '../src/project-folder-tree';

test('Windows paths retain the first authorized spelling, including UNC shares and drive roots',()=>{
  const paths=['C:\\','C:\\Demo\\Atlas','c:/demo/atlas/','C:\\Demo\\Atlas\\client','\\\\Host\\Team\\Library','//host/TEAM/library/'];
  const {root,projects}=projectFolderTree(paths);
  assert.equal(root.children.size,2);
  assert.deepEqual(projects.map(node=>node.project),[paths[0],paths[1],paths[3],paths[4]]);
  assert.equal(projects[2].parent,projects[1]);
  assert.deepEqual(filterProjectFolders(projects,'demo/atlas').map(node=>node.project),[paths[1],paths[3]]);
  assert.deepEqual(filterProjectFolders(projects,'index',()=> 'Team index'),projects);
});

test('Unix folders keep their case and any literal backslash',()=>{
  const paths=['/code/Atlas','/code/atlas','/code/not\\nested'];
  const {start,projects}=projectFolderTree(paths);
  assert.equal(start.name,'code');
  assert.deepEqual([...start.children.keys()],['Atlas','atlas','not\\nested']);
  assert.deepEqual(projects.map(node=>node.project),paths);
});

test('a project can be selected as well as opened to reach its nested repositories',()=>{
  const paths=['/work/lab','/work/lab/service','/work/lab/apps/mobile'];
  const {start,root}=projectFolderTree(paths);
  assert.equal(start.project,paths[0]);
  assert.equal(start.children.get('service')?.project,paths[1]);
  assert.equal(start.children.get('apps')?.project,undefined);
  assert.equal(root.project,undefined);
});
