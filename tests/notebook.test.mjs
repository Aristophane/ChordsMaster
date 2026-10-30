import {test} from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { deflateSync } from 'node:zlib';
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
test('Share links round-trip Unicode, alternate harmony, pitches, custom tuning and piano without local IDs',async()=>{
  const guitar=entry('private-id','private-folder');
  const piano={...entry('piano'),mode:'piano',notes:[25,60,104],frets:Array(6).fill(null),tuning:[38,45,50,54,57,62],tuningId:'custom',chordKey:null};
  const url=new URL(await createShareURL('https://example.org/ChordsMaster/#carnet',[guitar,piano],'Étude ♭ n° 2'));
  assert.equal(url.pathname,'/ChordsMaster/');assert.equal(url.search,'');
  assert.ok(url.hash.startsWith('#p=z'));
  const shared=await readShare(url.hash);assert.equal(shared.title,'Étude ♭ n° 2');assert.equal(shared.chords.length,2);
  for(const [i,original] of [guitar,piano].entries()){
    for(const field of ['title','notes','tuning','frets','mode','tuningId','preference','allowOmit','chordKey'])assert.deepEqual(shared.chords[i][field],original[field],field);
    assert.notEqual(shared.chords[i].id,original.id);assert.equal(shared.chords[i].folderId,null);
  }
  assert.notEqual((await readShare(url.hash)).chords[0].id,shared.chords[0].id);
});
test('Invalid backups and links fail atomically; unplayable or falsified diagrams are rejected',async()=>{
  assert.throws(()=>readNotebook({version:2,chords:[entry('good'),{...entry('bad'),notes:[49]}],folders:[]}));
  assert.throws(()=>readNotebook({version:2,chords:[],folders:[{id:'a',name:''}]}));
  assert.throws(()=>readNotebook({version:2,chords:[],folders:[{id:'a',name:'A'},{id:'a',name:'B'}]}));
  assert.equal(readNotebook({version:2,chords:[entry('orphan','missing')],folders:[]}).chords[0].folderId,null);
  for(const hash of ['#partage=','garbage','#partage=%FF','#partage=not_json','#partage='+('A'.repeat(MAX_SHARE_LENGTH+1)),'#p=zbroken','#p=x123'])await assert.rejects(readShare(hash));
  const forged=btoa(JSON.stringify([1,'',[['test',[49],[40,45,50,55,59,64],[null,3,2,0,null,null],0,'standard',0,1,null]]])).replace(/=+$/,'');
  await assert.rejects(readShare('#partage='+forged));
  await assert.rejects(createShareURL('https://example.org',[]));
  await assert.rejects(createShareURL('https://example.org',Array.from({length:500},(_,i)=>({...entry(String(i)),title:randomBytes(40).toString('hex')}))),/Lien trop long/);
});

const legacyURL=(chords,title='')=>'https://example.org/#partage='+Buffer.from(JSON.stringify([1,title,chords.map(e=>[e.title,e.notes,e.tuning,e.frets,e.mode==='piano'?1:0,e.tuningId,e.preference==='flat'?1:0,e.allowOmit?1:0,e.chordKey])])).toString('base64url');
test('Old uncompressed links remain readable with all metadata and exact positions',async()=>{
  const original=[entry('old')],shared=await readShare(new URL(legacyURL(original,'Ancien lien ♭')).hash);
  assert.equal(shared.title,'Ancien lien ♭');
  for(const key of ['title','notes','frets','tuning','tuningId','preference','allowOmit','chordKey'])assert.deepEqual(shared.chords[0][key],original[0][key]);
});
test('Compression substantially shortens real collections while keeping every chord and its order',async()=>{
  const chords=Array.from({length:50},(_,i)=>({...entry(String(i)),title:'Étude '+(i+1),notes:[48+i%12,52+i%12,55+i%12],frets:[null,3+i%12,2+i%12,i%12,null,null]}));
  const old=legacyURL(chords,'Répertoire'),url=await createShareURL('https://example.org/',chords,'Répertoire');
  assert.ok(url.length<old.length*.3,`${url.length} vs ${old.length}`);
  const shared=await readShare(new URL(url).hash);
  assert.deepEqual(shared.chords.map(e=>e.title),chords.map(e=>e.title));
  assert.deepEqual(shared.chords.map(e=>e.notes),chords.map(e=>e.notes));
  const repeated=Array.from({length:500},(_,i)=>entry(String(i)));
  assert.equal((await readShare(new URL(await createShareURL('https://example.org/',repeated)).hash)).chords.length,500);
});
test('Compact raw links, custom/reentrant guitar tunings and nonstandard note ordering remain lossless',async()=>{
  const guitar={...entry('custom'),tuningId:'custom',tuning:[40,45,50,55,59,60],frets:[null,3,2,0,null,0],notes:[60,55,48,52],chordKey:'0:6:full'};
  const shared=await readShare(new URL(await createShareURL('https://example.org/',[guitar])).hash);
  assert.deepEqual(shared.chords[0].notes,guitar.notes);assert.deepEqual(shared.chords[0].tuning,guitar.tuning);assert.equal(shared.chords[0].chordKey,guitar.chordKey);
  const raw=[2,'Sans compression',['standard'],[['Do','-320--',0,4,'0::full']]];
  const decoded=await readShare('#p=j'+Buffer.from(JSON.stringify(raw)).toString('base64url'));
  assert.deepEqual(decoded.chords[0].notes,[48,52,55]);assert.equal(decoded.chords[0].mode,'guitar');
});
test('Invalid compressed payloads, truncated streams and decompression bombs are rejected',async()=>{
  const invalid=[2,'',['standard'],[['Invalid','-z20--',0,4,null]]];
  await assert.rejects(readShare('#p=z'+deflateSync(JSON.stringify(invalid)).toString('base64url')));
  const url=await createShareURL('https://example.org/',[entry('valid')]);
  await assert.rejects(readShare(new URL(url).hash.slice(0,-8)));
  const bomb=deflateSync(' '.repeat(600_000)).toString('base64url');
  await assert.rejects(readShare('#p=z'+bomb));
});
test('Browsers without compression can create raw compact links; old links still work without decompression',async()=>{
  const compress=globalThis.CompressionStream,decompress=globalThis.DecompressionStream;
  const compressed=new URL(await createShareURL('https://example.org/',[entry('one'),entry('two')]));
  assert.ok(compressed.hash.startsWith('#p=z'));
  try{
    globalThis.CompressionStream=undefined;globalThis.DecompressionStream=undefined;
    const raw=new URL(await createShareURL('https://example.org/',[entry('one')]));
    assert.ok(raw.hash.startsWith('#p=j'));
    assert.deepEqual((await readShare(raw.hash)).chords[0].notes,[48,52,55]);
    assert.deepEqual((await readShare(new URL(legacyURL([entry('one')])).hash)).chords[0].notes,[48,52,55]);
    await assert.rejects(readShare(compressed.hash),/navigateur à jour/);
  }finally{globalThis.CompressionStream=compress;globalThis.DecompressionStream=decompress;}
});
