import { TUNINGS, guitarNotes } from './music.js';
import { moveChord } from './reorder.js';

export const MAX_CHORDS=500, MAX_FOLDERS=100, MAX_SHARE_LENGTH=12000;
const uuid=()=>crypto.randomUUID();
const validId=value=>typeof value==='string'&&value.length>0&&value.length<=100;
export const folderName=value=>typeof value==='string'?value.trim().slice(0,60):'';
const sameNotes=(a,b)=>JSON.stringify([...a].sort((x,y)=>x-y))===JSON.stringify([...b].sort((x,y)=>x-y));

export function validateEntry(entry){
  if(!entry||typeof entry!=='object'||!Array.isArray(entry.notes)||entry.notes.length<1||entry.notes.length>6||!entry.notes.every(n=>Number.isInteger(n)&&n>=24&&n<=107))return null;
  if(!Array.isArray(entry.tuning)||entry.tuning.length!==6||!entry.tuning.every(n=>Number.isInteger(n)&&n>=28&&n<=71))return null;
  if(!Array.isArray(entry.frets)||entry.frets.length!==6||!entry.frets.every(f=>f===null||(Number.isInteger(f)&&f>=0&&f<=24)))return null;
  if(entry.mode!=='guitar'&&entry.mode!=='piano')return null;
  if((entry.mode==='guitar'||entry.frets.some(f=>f!==null))&&!sameNotes(guitarNotes(entry.frets,entry.tuning),entry.notes))return null;
  const tuning=TUNINGS.find(t=>t.id===entry.tuningId&&sameNotes(t.notes,entry.tuning)&&t.notes.every((n,i)=>n===entry.tuning[i]));
  return {id:validId(entry.id)?entry.id:uuid(),title:typeof entry.title==='string'?entry.title.slice(0,80):'Mon accord',notes:[...entry.notes],tuning:[...entry.tuning],frets:[...entry.frets],mode:entry.mode,tuningId:tuning?.id||'custom',preference:entry.preference==='flat'?'flat':'sharp',allowOmit:entry.allowOmit!==false,chordKey:typeof entry.chordKey==='string'?entry.chordKey.slice(0,100):null,createdAt:typeof entry.createdAt==='string'?entry.createdAt:new Date().toISOString(),folderId:validId(entry.folderId)?entry.folderId:null};
}

// The old array and version 1 JSON backups migrate without changing chord IDs.
export function readNotebook(data){
  const legacy=Array.isArray(data);
  if(!legacy&&(!data||![1,2].includes(data.version)))throw Error('Format de sauvegarde ChordsMaster non reconnu.');
  const chords=legacy?data:data.chords, folders=legacy||data.version===1?[]:data.folders;
  if(!Array.isArray(chords)||chords.length>MAX_CHORDS||!Array.isArray(folders)||folders.length>MAX_FOLDERS)throw Error('Carnet invalide : 500 accords et 100 dossiers maximum.');
  const cleanFolders=folders.map(f=>{
    if(!f||!validId(f.id)||['all','_new','_choose'].includes(f.id)||!folderName(f.name))throw Error('La sauvegarde contient un dossier invalide.');
    return {id:f.id,name:folderName(f.name)};
  });
  if(new Set(cleanFolders.map(f=>f.id)).size!==cleanFolders.length)throw Error('La sauvegarde contient des dossiers en double.');
  const clean=chords.map(validateEntry);
  if(clean.some(e=>!e))throw Error('La sauvegarde contient un accord invalide. Aucun accord n’a été importé.');
  const ids=new Set(cleanFolders.map(f=>f.id));
  const unique=clean.filter((e,i,a)=>a.findIndex(x=>x.id===e.id)===i).map(e=>({...e,folderId:ids.has(e.folderId)?e.folderId:null}));
  return {version:2,chords:unique,folders:cleanFolders};
}

export function mergeNotebook(current,incoming){
  const folders=current.folders.map(f=>({...f})), mapping=new Map();
  for(const f of incoming.folders){
    let match=folders.find(x=>x.name.toLocaleLowerCase('fr')===f.name.toLocaleLowerCase('fr'));
    if(!match){match={...f,id:folders.some(x=>x.id===f.id)?uuid():f.id};folders.push(match);}
    mapping.set(f.id,match.id);
  }
  const added=incoming.chords.filter(e=>!current.chords.some(s=>s.id===e.id)).map(e=>({...e,folderId:mapping.get(e.folderId)||null}));
  if(current.chords.length+added.length>MAX_CHORDS||folders.length>MAX_FOLDERS)throw Error('Le carnet ne peut pas dépasser 500 accords et 100 dossiers.');
  return {version:2,chords:[...added,...current.chords],folders,added};
}

export const visibleChords=(chords,folder)=>folder==='all'?chords:chords.filter(e=>(e.folderId||'')===folder);
export function reorderInFolder(chords,folder,source,target){
  const visible=visibleChords(chords,folder), moved=moveChord(visible,source,target);
  if(moved===visible)return chords;
  const ids=new Set(visible.map(e=>e.id));let index=0;
  return chords.map(e=>ids.has(e.id)?moved[index++]:e);
}
export function chordSignature(e){return JSON.stringify([e.title,e.mode,e.tuning,e.notes,e.frets,e.chordKey,e.preference,e.allowOmit]);}

// Compact UTF-8 data lives in the fragment, which is not sent in HTTP requests.
export function createShareURL(base,chords,title=''){
  if(!chords.length||chords.length>MAX_CHORDS)throw Error('Sélectionnez au moins un accord.');
  const entries=chords.map(validateEntry);
  if(entries.some(e=>!e))throw Error('Un accord ne peut pas être partagé.');
  const compact=entries.map(e=>[e.title,e.notes,e.tuning,e.frets,e.mode==='piano'?1:0,e.tuningId,e.preference==='flat'?1:0,e.allowOmit?1:0,e.chordKey]);
  const bytes=new TextEncoder().encode(JSON.stringify([1,folderName(title),compact]));
  const encoded=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const url=new URL(base);url.hash='partage='+encoded;
  if(url.href.length>MAX_SHARE_LENGTH)throw Error('Lien trop long. Sélectionnez moins d’accords ou utilisez la sauvegarde JSON.');
  return url.href;
}
export function readShare(hash){
  const encoded=hash.startsWith('#partage=')?hash.slice(9):'';
  if(!encoded||encoded.length>MAX_SHARE_LENGTH||!/^[A-Za-z0-9_-]+$/.test(encoded))throw Error('Ce lien de partage est incomplet ou invalide.');
  try{
    const bytes=Uint8Array.from(atob(encoded.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
    const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(!Array.isArray(data)||data.length!==3||data[0]!==1||typeof data[1]!=='string'||!Array.isArray(data[2])||!data[2].length||data[2].length>MAX_CHORDS)throw Error();
    const chords=data[2].map(row=>{
      if(!Array.isArray(row)||row.length!==9||![0,1].includes(row[4])||![0,1].includes(row[6])||![0,1].includes(row[7])||typeof row[0]!=='string'||row[0].length>80||!(row[8]===null||typeof row[8]==='string'))throw Error();
      return validateEntry({title:row[0],notes:row[1],tuning:row[2],frets:row[3],mode:row[4]?'piano':'guitar',tuningId:row[5],preference:row[6]?'flat':'sharp',allowOmit:!!row[7],chordKey:row[8]});
    });
    if(chords.some(e=>!e))throw Error();
    return {title:folderName(data[1]),chords};
  }catch{throw Error('Ce lien de partage est incomplet ou invalide.');}
}
