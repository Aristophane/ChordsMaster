import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readNotebook,mergeNotebook,visibleChords,reorderInFolder,createShareURL,readShare,MAX_SHARE_LENGTH} from '../dist/notebook.js';
const entry=(id,folderId=null)=>({id,title:'Do majeur — été ♯',notes:[48,52,55],mode:'guitar',tuningId:'standard',tuning:[40,45,50,55,59,64],frets:[null,3,2,0,null,null],chordKey:'0::full',preference:'flat',allowOmit:false,createdAt:'2026-10-30T12:00:00Z',folderId});
test('Legacy local carnet and JSON backups migrate without losing pitches, ordering or IDs',()=>{
  const legacy=[entry('first'),entry('second')];
  const migrated=readNotebook(legacy);
  assert.equal(migrated.version,2);assert.deepEqual(migrated.folders,[]);assert.deepEqual(migrated.chords,legacy);
  assert.deepEqual(readNotebook({version:1,chords:legacy}),migrated);
  const v2={version:2,chords:[entry('first','folder')],folders:[{id:'folder',name:'Jazz'}]};
  assert.deepEqual(readNotebook(JSON.parse(JSON.stringify(v2))),v2);
});
test('Folders filter and reorder only their own slots, preserving hidden chord order and notes',()=>{
  const chords=[entry('a','jazz'),entry('hidden'),entry('b','jazz'),entry('other','rock')];
  assert.deepEqual(visibleChords(chords,'jazz').map(e=>e.id),['a','b']);
  assert.deepEqual(visibleChords(chords,'').map(e=>e.id),['hidden']);
  assert.deepEqual(reorderInFolder(chords,'jazz','a','b').map(e=>e.id),['b','hidden','a','other']);
  assert.equal(reorderInFolder(chords,'jazz','a','hidden'),chords);
  assert.deepEqual(chords[0].notes,[48,52,55]);
});
test('Backup merging remaps folder ID collisions, reuses equal names and never overwrites existing chords',()=>{
  const current=readNotebook({version:2,folders:[{id:'same',name:'Jazz'}],chords:[entry('existing','same')]});
  const incoming=readNotebook({version:2,folders:[{id:'same',name:'Rock'},{id:'another',name:'jazz'}],chords:[entry('existing','same'),entry('rock','same'),entry('jazz','another')]});
  const merged=mergeNotebook(current,incoming);
  assert.equal(merged.chords.length,3);assert.equal(merged.folders.length,2);
  assert.notEqual(merged.folders[1].id,'same');
  assert.equal(merged.chords.find(e=>e.id==='rock').folderId,merged.folders[1].id);
  assert.equal(merged.chords.find(e=>e.id==='jazz').folderId,'same');
  assert.deepEqual(merged.chords.find(e=>e.id==='existing'),current.chords[0]);
});
test('Share links round-trip Unicode, alternate harmony, pitches, custom tuning and piano without local IDs',()=>{
  const guitar=entry('private-id','private-folder');
  const piano={...entry('piano'),mode:'piano',notes:[25,60,104],frets:Array(6).fill(null),tuning:[38,45,50,54,57,62],tuningId:'custom',chordKey:null};
  const url=new URL(createShareURL('https://example.org/ChordsMaster/#carnet',[guitar,piano],'Étude ♭ n° 2'));
  assert.equal(url.pathname,'/ChordsMaster/');assert.equal(url.search,'');
  const shared=readShare(url.hash);assert.equal(shared.title,'Étude ♭ n° 2');assert.equal(shared.chords.length,2);
  for(const [i,original] of [guitar,piano].entries()){
    for(const field of ['title','notes','tuning','frets','mode','tuningId','preference','allowOmit','chordKey'])assert.deepEqual(shared.chords[i][field],original[field],field);
    assert.notEqual(shared.chords[i].id,original.id);assert.equal(shared.chords[i].folderId,null);
  }
  assert.notEqual(readShare(url.hash).chords[0].id,shared.chords[0].id);
});
test('Invalid backups and links fail atomically; unplayable or falsified diagrams are rejected',()=>{
  assert.throws(()=>readNotebook({version:2,chords:[entry('good'),{...entry('bad'),notes:[49]}],folders:[]}));
  assert.throws(()=>readNotebook({version:2,chords:[],folders:[{id:'a',name:''}]}));
  assert.throws(()=>readNotebook({version:2,chords:[],folders:[{id:'a',name:'A'},{id:'a',name:'B'}]}));
  assert.equal(readNotebook({version:2,chords:[entry('orphan','missing')],folders:[]}).chords[0].folderId,null);
  for(const hash of ['#partage=','garbage','#partage=%FF','#partage=not_json','#partage='+('A'.repeat(MAX_SHARE_LENGTH+1))])assert.throws(()=>readShare(hash));
  const forged=btoa(JSON.stringify([1,'',[['test',[49],[40,45,50,55,59,64],[null,3,2,0,null,null],0,'standard',0,1,null]]])).replace(/=+$/,'');
  assert.throws(()=>readShare('#partage='+forged));
  assert.throws(()=>createShareURL('https://example.org',[]));
  assert.throws(()=>createShareURL('https://example.org',Array.from({length:500},(_,i)=>entry(String(i)))),/Lien trop long/);
});
