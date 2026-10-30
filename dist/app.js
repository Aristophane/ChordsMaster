import { mod, TUNINGS, noteName, frenchName, chordLabel, analyze, guitarNotes, findFingering, transposeGuitar, intervalName } from './music.js';
import { createChordPDF } from './pdf.js';
import { readNotebook, mergeNotebook, visibleChords, reorderInFolder, folderName, chordSignature, createShareURL, readShare } from './notebook.js';

const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='chordsmaster.carnet.v2', LEGACY_STORAGE='chordsmaster.carnet.v1';
const state={mode:'guitar',tuningId:'standard',tuning:[40,45,50,55,59,64],frets:[null,3,2,0,0,0],pianoNotes:[],preference:'sharp',french:true,allowOmit:true,chosenKey:null,transpose:0,range:0,showNotes:false,pianoLabels:true,saved:[],folders:[],folder:'all',saveFolder:'',checked:new Set()};
let shared=null,sharedHash='',sharedChecked=new Set(),folderEdit=null;
const currentNotebook=()=>({version:2,chords:state.saved,folders:state.folders});
const filteredChords=()=>visibleChords(state.saved,state.folder);
let result, chosen, audioContext, toastTimer, pendingDeletion;
let storageUnreadable=false;
const tuningLabel=()=>state.tuningId==='custom'?'Personnalisé':TUNINGS.find(t=>t.id===state.tuningId)?.name||'Personnalisé';
const notes=()=>state.mode==='guitar'?guitarNotes(state.frets,state.tuning):[...state.pianoNotes];
const displayNote=(n,octave=false)=>noteName(n,state.preference,state.french,octave);

function notify(message,error=false,undo=false){
  clearTimeout(toastTimer);
  $('toast').classList.toggle('error',error);
  $('toast').textContent=message;
  if(undo){const button=document.createElement('button');button.textContent='Annuler';button.style.cssText='color:inherit;text-decoration:underline;margin-left:15px';button.onclick=undoDelete;$('toast').append(button);}
  $('toast').hidden=false;
  toastTimer=setTimeout(()=>{$('toast').hidden=true;pendingDeletion=null;},undo?9000:4500);
}

function readStorage(){
  try {const raw=localStorage.getItem(STORAGE)??localStorage.getItem(LEGACY_STORAGE);const data=raw?readNotebook(JSON.parse(raw)):{chords:[],folders:[]};state.saved=data.chords;state.folders=data.folders;storageUnreadable=false;}
  catch{state.saved=[];storageUnreadable=true;setTimeout(()=>notify('Le carnet existant est illisible ou inaccessible. Exportez vos nouvelles idées en JSON avant de fermer.',true),300);}
}
function persist(){
  if(storageUnreadable){notify('La sauvegarde locale est inaccessible. Utilisez la sauvegarde JSON pour garder votre carnet.',true);return false;}
  try{localStorage.setItem(STORAGE,JSON.stringify(currentNotebook()));return true;}catch{notify('La sauvegarde locale est indisponible ou pleine. Votre carnet peut être exporté en JSON.',true);return false;}
}

function update(){
  const current=notes();
  result=analyze(current,state.preference,state.allowOmit);
  chosen=result.candidates.find(c=>c.key===state.chosenKey)||result.candidates[0]||null;
  state.chosenKey=chosen?.key||null;
  renderAnalysis();renderGuitar();renderPiano();
  $('note-count').innerHTML=current.length+' <span>/ 6 notes</span>';
  $('guitar-controls').hidden=false;
  document.querySelector('.range-field').hidden=state.mode!=='guitar';
  $('guitar-area').hidden=state.mode!=='guitar';
  $('custom-tuning').hidden=state.tuningId!=='custom';
  $('piano-editor-intro').hidden=state.mode!=='piano';
  document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===state.mode;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  $('sync-label').hidden=state.mode==='piano';
  const mapped=state.mode==='guitar'?state.frets:findFingering(current,state.tuning,state.frets);
  $('piano-mapping').textContent=current.length&&!mapped?'Position impossible sur six cordes avec cet accordage.':'';
  $('transpose-value').textContent=state.transpose>0?'+'+state.transpose:state.transpose;
  $('transpose-plural').textContent=Math.abs(state.transpose)>1?'s':'';
  $('transpose-down').disabled=$('transpose-up').disabled=$('clear-button').disabled=current.length===0;
  $('play-button').disabled=$('save-button').disabled=current.length===0;
  $('saved-count').textContent=state.saved.length;
}

function renderAnalysis(){
  const symbol=$('chord-symbol');
  symbol.className='';
  $('result-status').classList.toggle('unknown',!chosen);
  $('result-status').textContent=chosen?'Reconnu':result.kind==='empty'?'À vous de jouer':result.kind==='unknown'?'À explorer':'Notes choisies';
  if(chosen){
    symbol.textContent=chordLabel(chosen,state.preference);
    symbol.classList.toggle('long-symbol',symbol.textContent.length>9);
    $('chord-title').textContent=frenchName(chosen.rootName)+' '+chosen.title;
    $('chord-inversion').textContent=chosen.inversion;
    $('chord-inversion').hidden=false;
    $('tone-list').innerHTML=chosen.tones.filter(t=>t.present).map(t=>`<span class="tone ${t.degree==='1'?'root':''}"><strong>${esc(displayNote(t.pc))}</strong><small>${esc(t.degree)}</small></span>`).join('');
    $('omission-note').hidden=!chosen.omitted.length;
    $('omission-note').textContent='Quinte juste omise · sans 5';
  }else{
    symbol.classList.add('unknown-symbol');
    symbol.textContent=result.kind==='empty'?'—':result.kind==='single'?displayNote(result.notes[0]):result.kind==='interval'?intervalName(result.notes):'Notes libres';
    $('chord-title').textContent=result.kind==='empty'?'Sélectionnez vos notes':result.kind==='single'?'Note / octaves':result.kind==='interval'?'Intervalle':'Aucune formule exacte du catalogue';
    $('chord-inversion').hidden=true;
    $('tone-list').innerHTML=(result.pcs||[]).map(pc=>`<span class="tone"><strong>${esc(displayNote(pc))}</strong><small>note</small></span>`).join('');
    $('omission-note').hidden=true;
  }
  const bass=result.notes[0];
  $('bass-note').textContent=bass===undefined?'—':displayNote(bass,true);
  $('alternatives').hidden=result.candidates.length<2;
  $('chord-alternative').innerHTML=result.candidates.map(c=>`<option value="${esc(c.key)}" ${c.key===chosen?.key?'selected':''}>${esc(chordLabel(c,state.preference))}${c.omitted.length?' · sans 5':''}</option>`).join('');
}

function labelForMidi(midi,withOctave=false){
  return displayNote(midi,withOctave);
}
function renderGuitar(){
  const start=state.range==='all'?1:Number(state.range)+1;
  const end=state.range==='all'?24:Number(state.range)+12;
  const count=end-start+1;
  const board=$('fretboard');board.style.setProperty('--frets',count);
  board.style.minWidth=state.range==='all'?'1150px':'';
  board.classList.toggle('show-all-notes',state.showNotes);
  let html='<span></span><span></span><span class="fret-label">0</span>';
  for(let f=start;f<=end;f++)html+=`<span class="fret-label ${f===12||f===24?'octave':''}">${f}</span>`;
  for(let s=5;s>=0;s--){
    const n=state.tuning[s];
    html+=`<span class="string-label" title="Corde ${6-s} · ${esc(displayNote(n,true))}">${esc(noteName(n,state.preference))}<small>${Math.floor(n/12)-1}</small></span><button class="mute-button ${state.frets[s]===null?'muted':''}" data-mute="${s}" aria-label="Rendre la corde ${6-s} muette" aria-pressed="${state.frets[s]===null}">×</button>`;
    for(const f of [0,...Array.from({length:count},(_,i)=>start+i)]){
      const midi=n+f,selected=state.frets[s]===f;
      const root=chosen&&mod(midi)===chosen.root;
      html+=`<button class="fret-cell ${f===0?'open-string ':''}${selected?'selected ':''}${root?'is-root':''}" style="--string-size:${s===5?1:s===4?1.2:s===3?1.5:s===2?1.8:s===1?2.2:2.6}px" data-string="${s}" data-fret="${f}" aria-label="Corde ${6-s}, ${f===0?'à vide':'case '+f}, ${esc(labelForMidi(midi,true))}" aria-pressed="${selected}"><span class="fret-note">${selected||f!==0?esc(labelForMidi(midi)):'○'}</span></button>`;
    }
  }
  html+='<span></span><span></span><span></span>';
  for(let f=start;f<=end;f++)html+=`<span class="fret-marker">${[3,5,7,9,15,17,19,21].includes(f)?'<span></span>':f===12||f===24?'<span></span><span></span>':''}</span>`;
  const focused=document.activeElement;const focusString=focused?.dataset.string,focusFret=focused?.dataset.fret,focusMute=focused?.dataset.mute;
  board.innerHTML=html;
  if(focusString!==undefined)board.querySelector(`[data-string="${focusString}"][data-fret="${focusFret}"]`)?.focus({preventScroll:true});
  else if(focusMute!==undefined)board.querySelector(`[data-mute="${focusMute}"]`)?.focus({preventScroll:true});
}
function renderPiano(){
  const current=notes(),min=current.length?Math.min(...current):36,max=current.length?Math.max(...current):83;
  const start=Math.max(24,Math.min(36,Math.floor(min/12)*12)),end=Math.min(107,Math.max(83,Math.floor(max/12)*12+11));
  const whites=Array.from({length:end-start+1},(_,i)=>start+i).filter(n=>[0,2,4,5,7,9,11].includes(mod(n)));
  let html='';
  const key=(n,black,extra='')=>{const doubles=current.filter(m=>m===n).length;return `<button class="piano-key ${black?'black':'white'} ${current.includes(n)?'selected':''} ${chosen&&mod(n)===chosen.root?'is-root':''}" data-midi="${n}" ${extra} aria-label="${esc(labelForMidi(n,true))}${doubles>1?', doublée '+doubles+' fois':''}" aria-pressed="${current.includes(n)}"><span>${state.pianoLabels?esc(labelForMidi(n)):''}</span>${doubles>1?`<span class="doubling">×${doubles}</span>`:''}${!black&&mod(n)===0?`<small>${Math.floor(n/12)-1}</small>`:''}</button>`;};
  for(const n of whites)html+=key(n,false);
  for(let n=start;n<=end;n++)if([1,3,6,8,10].includes(mod(n))){const index=whites.filter(w=>w<n).length;html+=key(n,true,`style="left:calc(4px + (100% - 8px) * ${index/whites.length} - (100% - 8px) * ${.3/whites.length});width:calc((100% - 8px) * ${.6/whites.length})"`);}
  const focused=document.activeElement?.dataset.midi;
  $('piano').style.minWidth=Math.max(680,whites.length*24)+'px';
  $('piano').innerHTML=html;
  if(focused!==undefined)$('piano').querySelector(`[data-midi="${focused}"]`)?.focus({preventScroll:true});
  $('piano-range-label').textContent=displayNote(start,true)+' — '+displayNote(end,true);
}

function chooseMode(mode){
  if(mode===state.mode)return;
  if(mode==='piano')state.pianoNotes=guitarNotes(state.frets,state.tuning);
  else{
    const fingering=findFingering(state.pianoNotes,state.tuning,state.frets);
    if(!fingering){notify('Ces hauteurs ne sont pas réalisables sur six cordes dans cet accordage. Retirez une note, transposez ou changez l’accordage.',true);return;}
    state.frets=fingering;
    if(state.frets.some(f=>f>12)&&!state.frets.some(f=>f!==null&&f>0&&f<13)){state.range=12;$('fret-range').value='12';}
    else if(state.frets.some(f=>f>12)){state.range='all';$('fret-range').value='all';}
  }
  state.mode=mode;update();
}
function changeTuning(){
  state.tuningId=$('tuning-select').value;
  if(state.tuningId!=='custom')state.tuning=[...TUNINGS.find(t=>t.id===state.tuningId).notes];
  else renderCustomTuning();
  state.transpose=0;state.chosenKey=null;update();
  if(state.mode==='guitar'&&notes().length)notify('Accordage modifié : les cases sont conservées, les hauteurs sont recalculées.');
}
function renderCustomTuning(){
  $('custom-strings').innerHTML=state.tuning.map((n,s)=>`<label>Corde ${6-s}<select data-custom-string="${s}">${Array.from({length:44},(_,i)=>28+i).map(m=>`<option value="${m}" ${m===n?'selected':''}>${esc(noteName(m,state.preference,false,true))}</option>`).join('')}</select></label>`).join('');
}
function transpose(direction){
  const amount=Number($('transpose-amount').value)*direction;
  const current=notes();if(!current.length)return;
  const moved=current.map(n=>n+amount);
  if(moved.some(n=>n<24||n>107)){notify('La transposition dépasse la plage du clavier (Do1 à Si7).',true);return;}
  if(state.mode==='guitar'){
    const shifted=transposeGuitar(state.frets,state.tuning,amount);
    if(!shifted){notify('Ces hauteurs dépassent les possibilités de cet accordage sur 24 cases. Essayez le piano ou un autre accordage.',true);return;}
    const direct=state.frets.every((f,s)=>f===null||shifted[s]===f+amount);
    state.frets=shifted;
    if(!direct)notify('Une autre position conserve exactement les notes transposées et leurs octaves.');
    if(state.frets.some(f=>f>12)){
      state.range=state.frets.some(f=>f!==null&&f>0&&f<13)?'all':12;$('fret-range').value=String(state.range);
    }else{state.range=0;$('fret-range').value='0';}
  }else state.pianoNotes=moved;
  // Follow the chosen harmonic root across transposition, including ambiguous chords.
  state.chosenKey=chosen?`${mod(chosen.root+amount)}:${chosen.suffix}:${chosen.omitted.length?'no5':'full'}`:null;
  state.transpose+=amount;update();
}

async function playChord(chordNotes=notes()){
  if(!chordNotes.length)return;
  try{
    audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
    await audioContext.resume();
    const master=audioContext.createGain();master.gain.value=.5/Math.sqrt(chordNotes.length);master.connect(audioContext.destination);
    const start=audioContext.currentTime+.02;
    [...chordNotes].sort((a,b)=>a-b).forEach((midi,index)=>{
      const frequency=440*2**((midi-69)/12),t=start+index*.025;
      for(const [multiple,volume] of [[1,.6],[2,.18],[3,.07]]){
        const oscillator=audioContext.createOscillator(),envelope=audioContext.createGain();
        oscillator.type='sine';oscillator.frequency.value=frequency*multiple;
        envelope.gain.setValueAtTime(0,t);envelope.gain.linearRampToValueAtTime(volume,t+.012);envelope.gain.exponentialRampToValueAtTime(.001,t+1.8);
        oscillator.connect(envelope);envelope.connect(master);oscillator.start(t);oscillator.stop(t+2);
      }
    });
    setTimeout(()=>master.disconnect(),2300);
  }catch{notify('La lecture audio n’est pas disponible dans ce navigateur.',true);}
}
function saveChord(){
  if(!notes().length)return;
  if(state.saved.length>=500){notify('Le carnet contient déjà 500 accords. Exportez-le avant d’en ajouter.',true);return;}
  const entry={id:crypto.randomUUID(),title:chosen?frenchName(chosen.rootName)+' '+chosen.title:result.kind==='single'?displayNote(result.notes[0]):result.kind==='interval'?intervalName(result.notes):'Notes libres',notes:notes(),mode:state.mode,tuningId:state.tuningId,tuning:[...state.tuning],frets:state.mode==='guitar'?[...state.frets]:findFingering(notes(),state.tuning,state.frets)||Array(6).fill(null),chordKey:chosen?.key||null,preference:state.preference,allowOmit:state.allowOmit,createdAt:new Date().toISOString(),folderId:state.saveFolder||null};
  const signature=e=>JSON.stringify([e.mode,e.tuning,[...e.notes].sort((a,b)=>a-b),e.frets,e.chordKey]);
  if(state.saved.some(e=>e.folderId===entry.folderId&&signature(e)===signature(entry))){notify('Cet accord et cette position sont déjà dans ce dossier.');return;}
  state.folder=state.saveFolder;
  state.saved.unshift(entry);state.checked.add(entry.id);
  const stored=persist();renderLibrary();update();
  if(stored)notify('Accord gardé dans votre carnet.');
}
function entryAnalysis(entry){const a=analyze(entry.notes,entry.preference,entry.allowOmit);return {a,c:a.candidates.find(c=>c.key===entry.chordKey)||a.candidates[0]||null};}
function miniGuitar(entry,c){
  const playable=entry.frets.some(f=>f!==null);
  if(!playable)return '<svg class="mini-guitar" viewBox="0 0 86 109" aria-label="Accord créé au piano"><path d="M5 25h76v52H5zM16 25v52m11-52v52m11-52v52m11-52v52m11-52v52m11-52v52" stroke="#c7c6b9"/><path d="M13 25v30h8V25m4 0v30h8V25m17 0v30h8V25m4 0v30h8V25" fill="#3d4138" stroke="none"/><text x="43" y="96" text-anchor="middle">PIANO</text></svg>';
  const used=entry.frets.filter(f=>f!==null&&f>0),min=used.length?Math.min(...used):1,max=used.length?Math.max(...used):4;
  const start=max<=4?1:min,rows=Math.max(4,max-start+1),height=Math.max(112,rows*16),step=height/rows,top=30,left=35,width=110;
  let svg=`<svg class="mini-guitar" viewBox="0 0 160 ${height+58}" role="img" aria-label="Diagramme de guitare, cases ${start} à ${start+rows-1}, position ${esc(entry.frets.map(f=>f===null?'muette':f).join(', '))}">`;
  for(let s=0;s<6;s++)svg+=`<path class="diagram-string" d="M${left+s*22} ${top}v${height}"/>`;
  for(let f=0;f<=rows;f++)svg+=`<path class="diagram-fret ${f===0&&start===1?'diagram-nut':''}" d="M${left} ${top+f*step}h${width}"/>`;
  for(let f=0;f<rows;f++)svg+=`<text class="fret-number" x="18" y="${top+(f+.5)*step+4}" text-anchor="end">${start+f}</text>`;
  entry.frets.forEach((f,s)=>{
    const x=left+s*22,isRoot=f!==null&&c&&mod(entry.tuning[s]+f)===c.root;
    if(f===null)svg+=`<text class="string-mute" x="${x}" y="19" text-anchor="middle">×</text>`;
    else if(f===0)svg+=`<circle class="open-string ${isRoot?'root':''}" cx="${x}" cy="14" r="5"/>`;
    else svg+=`<circle class="${isRoot?'root':''}" cx="${x}" cy="${top+(f-start+.5)*step}" r="${Math.min(8,step*.34)}"/>`;
    svg+=`<text class="string-position" x="${x}" y="${top+height+23}" text-anchor="middle">${f===null?'×':f}</text>`;
  });
  return svg+'</svg>';
}
function renderLibrary(){
  renderFolders();
  const visible=filteredChords();
  $('saved-count').textContent=state.saved.length;
  state.checked=new Set([...state.checked].filter(id=>visible.some(e=>e.id===id)));
  $('library-count').textContent=visible.length+' accord'+(visible.length>1?'s':'');
  $('library-empty').hidden=visible.length>0;
  $('library-empty-title').textContent=state.saved.length?'Aucun accord dans ce dossier.':'Aucun accord enregistré.';
  $('export-count').textContent=state.checked.size;
  $('export-pdf').disabled=$('move-folder').disabled=!state.checked.size;
  $('share-button').disabled=!visible.length;
  $('backup-button').disabled=!state.saved.length&&!state.folders.length;
  $('select-all').checked=!!visible.length&&state.checked.size===visible.length;
  $('select-all').indeterminate=state.checked.size>0&&state.checked.size<visible.length;
  $('select-all').disabled=!visible.length;
  $('library-grid').innerHTML=visible.map(entry=>cardMarkup(entry)).join('');
}
function cardMarkup(entry,preview=false){
    const {c}=entryAnalysis(entry),symbol=c?chordLabel(c,entry.preference):entry.notes.map(n=>noteName(n,entry.preference)).filter((n,i,a)=>a.indexOf(n)===i).join(' · ');
    const tones=c?c.tones.filter(t=>t.present).map(t=>noteName(t.pc,entry.preference)):[...new Set(entry.notes.map(n=>noteName(n,entry.preference)))];
    const folderCaption=!preview&&state.folder==='all'?(state.folders.find(f=>f.id===entry.folderId)?.name||'Sans dossier'):'';
    const selected=(preview?sharedChecked:state.checked).has(entry.id);
    return `<article class="saved-card ${selected?'is-checked':''} ${preview?'shared-card':''}" data-id="${esc(entry.id)}"><div class="saved-card-header"><h2>${esc(symbol)}</h2><div class="card-tools">${preview?'':`<button class="drag-handle" data-move="${esc(entry.id)}" aria-label="Déplacer ${esc(symbol)}" aria-describedby="reorder-help" title="Glisser pour déplacer · flèches au clavier"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="5" r="1"/><circle cx="16" cy="5" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="19" r="1"/><circle cx="16" cy="19" r="1"/></svg></button>`}<label><span class="sr-only">Sélectionner ${esc(symbol)}</span><input type="checkbox" ${preview?'data-shared-select':'data-select'}="${esc(entry.id)}" ${selected?'checked':''}></label></div></div>${preview?`<p class="saved-title-input">${esc(entry.title)}</p>`:`<input class="saved-title-input" aria-label="Nom personnalisé de l’accord" maxlength="80" data-title="${esc(entry.id)}" value="${esc(entry.title)}">`}<div class="card-diagrams">${miniGuitar(entry,c)}</div><details class="saved-details"><summary>${esc(entry.tuningId==='custom'?'Personnalisé':TUNINGS.find(t=>t.id===entry.tuningId)?.name||'Personnalisé')}${c?.omitted.length?' · sans 5':''}${folderCaption?`<span class="card-folder"> · ${esc(folderCaption)}</span>`:''}</summary><p class="tuning-caption">${entry.tuning.map(n=>noteName(n,entry.preference)).join(' – ')}</p><div class="saved-tones">${tones.map(t=>`<span>${esc(t)}</span>`).join('')}</div><p class="saved-midi">${[...entry.notes].sort((a,b)=>a-b).map(n=>noteName(n,entry.preference,false,true)).join(' · ')}${c?'<br>'+esc(c.inversion):''}</p></details><div class="saved-actions"><button class="load-chord" data-${preview?'shared-':''}load="${esc(entry.id)}">Ouvrir <span aria-hidden="true">↗</span></button><button data-${preview?'shared-':''}play="${esc(entry.id)}" aria-label="Écouter ${esc(symbol)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 12 8-12 8V4Z"/></svg></button>${preview?'':`<button data-delete="${esc(entry.id)}" aria-label="Supprimer ${esc(symbol)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg></button>`}</div></article>`;
}
function reorderChord(sourceId,targetId,keyboard=false){
  // Another open tab may have added or edited chords while this card was dragged.
  let saved=state.saved;
  try{
    const raw=localStorage.getItem(STORAGE);
    if(raw){const fresh=readNotebook(JSON.parse(raw));if(fresh.chords.some(e=>e.id===sourceId)&&fresh.chords.some(e=>e.id===targetId)){saved=fresh.chords;state.folders=fresh.folders;}}
  }catch{/* Keep the in-memory collection if storage is unavailable. */}
  const reordered=reorderInFolder(saved,state.folder,sourceId,targetId);
  if(reordered===saved)return;
  state.saved=reordered;
  const stored=persist();renderLibrary();
  if(keyboard)[...$('library-grid').querySelectorAll('[data-move]')].find(el=>el.dataset.move===sourceId)?.focus();
  if(stored)notify('Accord déplacé · '+(filteredChords().findIndex(e=>e.id===sourceId)+1)+' / '+filteredChords().length);
}

let libraryDrag=null,dragFrame=0,suppressClickUntil=0;
function updateDropTarget(){
  const drag=libraryDrag;if(!drag?.active)return;
  const target=document.elementFromPoint(drag.x,drag.y)?.closest('.saved-card');
  const valid=target&&$('library-grid').contains(target)&&target!==drag.card?target:null;
  if(valid===drag.target)return;
  drag.target?.classList.remove('drop-target');
  drag.target=valid;valid?.classList.add('drop-target');
}
function dragAutoScroll(){
  const drag=libraryDrag;if(!drag?.active)return;
  const top=64,bottom=innerHeight-64;
  const delta=drag.y<top?-Math.ceil((top-drag.y)/4):drag.y>bottom?Math.ceil((drag.y-bottom)/4):0;
  if(delta){window.scrollBy(0,Math.max(-18,Math.min(18,delta)));updateDropTarget();}
  dragFrame=requestAnimationFrame(dragAutoScroll);
}
function endLibraryDrag(commit=false){
  const drag=libraryDrag;if(!drag)return;
  libraryDrag=null;cancelAnimationFrame(dragFrame);
  drag.ghost?.remove();drag.card.classList.remove('is-dragging');drag.target?.classList.remove('drop-target');
  document.body.classList.remove('sorting-chords');
  if(drag.card.hasPointerCapture(drag.pointerId))drag.card.releasePointerCapture(drag.pointerId);
  if(drag.active)suppressClickUntil=Date.now()+250;
  if(commit&&drag.active&&drag.target)reorderChord(drag.card.dataset.id,drag.target.dataset.id);
}
$('library-grid').addEventListener('pointerdown',e=>{
  if(e.button!==0||libraryDrag)return;
  const card=e.target.closest('.saved-card');if(!card)return;
  const handle=e.target.closest('[data-move]');
  if(e.pointerType==='touch'&&!handle)return;
  if(!handle&&e.target.closest('button,input,select,a,summary,details'))return;
  const rect=card.getBoundingClientRect();
  libraryDrag={card,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,rect,active:false,target:null};
  card.setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove',e=>{
  const drag=libraryDrag;if(!drag||e.pointerId!==drag.pointerId)return;
  drag.x=e.clientX;drag.y=e.clientY;
  if(!drag.active){
    if(Math.hypot(drag.x-drag.startX,drag.y-drag.startY)<6)return;
    drag.active=true;drag.ghost=drag.card.cloneNode(true);
    drag.ghost.className='saved-card drag-ghost';drag.ghost.setAttribute('aria-hidden','true');drag.ghost.inert=true;
    drag.ghost.style.width=drag.rect.width+'px';document.body.append(drag.ghost);
    drag.card.classList.add('is-dragging');document.body.classList.add('sorting-chords');
    dragFrame=requestAnimationFrame(dragAutoScroll);
  }
  e.preventDefault();
  drag.ghost.style.transform=`translate(${drag.x-drag.offsetX}px, ${drag.y-drag.offsetY}px)`;
  updateDropTarget();
},{passive:false});
document.addEventListener('pointerup',e=>{if(libraryDrag&&e.pointerId===libraryDrag.pointerId)endLibraryDrag(true);});
document.addEventListener('pointercancel',()=>endLibraryDrag());
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&libraryDrag){e.preventDefault();endLibraryDrag();}});
$('library-grid').addEventListener('lostpointercapture',()=>endLibraryDrag());
window.addEventListener('blur',()=>endLibraryDrag());
$('library-grid').addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
$('library-grid').addEventListener('keydown',e=>{
  if(e.key==='Escape'&&libraryDrag){e.preventDefault();endLibraryDrag();return;}
  const handle=e.target.closest('[data-move]');if(!handle)return;
  const visible=filteredChords(),index=visible.findIndex(entry=>entry.id===handle.dataset.move);
  const columns=getComputedStyle($('library-grid')).gridTemplateColumns.split(' ').length;
  const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns,Home:-index,End:visible.length-1-index};
  if(!(e.key in offsets))return;
  e.preventDefault();
  const to=Math.max(0,Math.min(visible.length-1,index+offsets[e.key]));
  if(to!==index)reorderChord(handle.dataset.move,visible[to].id,true);
});
function loadChord(entry){
  Object.assign(state,{mode:entry.mode,tuningId:entry.tuningId,tuning:[...entry.tuning],frets:[...entry.frets],pianoNotes:[...entry.notes],preference:entry.preference,allowOmit:entry.allowOmit,chosenKey:entry.chordKey,transpose:0});
  state.range=entry.frets.some(f=>f>12)?'all':0;
  $('tuning-select').value=state.tuningId;$('fret-range').value=String(state.range);$('accidentals').value=state.preference;$('omit-fifth').checked=state.allowOmit;
  if(state.tuningId==='custom')renderCustomTuning();
  update();location.hash='atelier';notify('Accord ouvert dans l’atelier.');
}
function deleteEntry(id){
  const index=state.saved.findIndex(e=>e.id===id);if(index<0)return;
  pendingDeletion={entry:state.saved[index],index,selected:state.checked.has(id)};
  state.saved.splice(index,1);state.checked.delete(id);const stored=persist();renderLibrary();if(stored)notify('Accord retiré du carnet.',false,true);
}
function undoDelete(){if(!pendingDeletion)return;const {entry,index,selected}=pendingDeletion;state.saved.splice(index,0,entry);if(selected)state.checked.add(entry.id);pendingDeletion=null;persist();renderLibrary();notify('Accord restauré.');}
function folderOptions(){return '<option value="">Sans dossier</option>'+state.folders.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');}
function renderFolders(){
  if(state.folder!=='all'&&state.folder&&!state.folders.some(f=>f.id===state.folder))state.folder='';
  if(state.saveFolder&&!state.folders.some(f=>f.id===state.saveFolder))state.saveFolder='';
  $('folder-filter').innerHTML=`<option value="all">Tous les accords (${state.saved.length})</option><option value="">Sans dossier (${state.saved.filter(e=>!e.folderId).length})</option>`+state.folders.map(f=>`<option value="${esc(f.id)}">${esc(f.name)} (${state.saved.filter(e=>e.folderId===f.id).length})</option>`).join('');
  $('folder-filter').value=state.folder;
  $('save-folder').innerHTML=folderOptions();$('save-folder').value=state.saveFolder;
  $('move-folder').innerHTML='<option value="_choose">Déplacer vers…</option>'+folderOptions();$('move-folder').value='_choose';
  $('rename-folder').hidden=$('delete-folder').hidden=state.folder==='all'||!state.folder;
}
function editFolder(rename=false){
  folderEdit=rename?state.folder:null;
  $('folder-form').hidden=false;$('folder-error').textContent='';
  $('folder-name').value=rename?state.folders.find(f=>f.id===folderEdit)?.name||'':'';
  $('folder-name').focus();
}
function commitFolder(e){
  e.preventDefault();const name=folderName($('folder-name').value);
  if(!name){$('folder-error').textContent='Indiquez un nom de dossier.';return;}
  if(state.folders.some(f=>f.id!==folderEdit&&f.name.toLocaleLowerCase('fr')===name.toLocaleLowerCase('fr'))){$('folder-error').textContent='Un dossier porte déjà ce nom.';return;}
  if(!folderEdit&&state.folders.length>=100){$('folder-error').textContent='Le carnet contient déjà 100 dossiers.';return;}
  if(folderEdit){const folder=state.folders.find(f=>f.id===folderEdit);if(!folder){$('folder-error').textContent='Ce dossier a été supprimé dans un autre onglet.';return;}folder.name=name;}
  else{const id=crypto.randomUUID();state.folders.push({id,name});state.folder=id;state.saveFolder=id;state.checked.clear();}
  const stored=persist();$('folder-form').hidden=true;renderLibrary();if(stored)notify(folderEdit?'Dossier renommé.':'Dossier créé.');
  $('folder-filter').focus();
}
function removeFolder(){
  const folder=state.folders.find(f=>f.id===state.folder);if(!folder)return;
  if(!confirm(`Supprimer le dossier « ${folder.name} » ? Ses accords seront conservés dans « Sans dossier ».`))return;
  state.folders=state.folders.filter(f=>f.id!==folder.id);
  state.saved.forEach(e=>{if(e.folderId===folder.id)e.folderId=null;});
  if(pendingDeletion?.entry.folderId===folder.id)pendingDeletion.entry.folderId=null;
  state.folder='';state.saveFolder='';state.checked.clear();$('folder-form').hidden=true;
  const stored=persist();renderLibrary();if(stored)notify('Dossier supprimé. Ses accords sont dans « Sans dossier ».');
}
function moveSelection(target){
  if(target==='_choose'||(target&&!state.folders.some(f=>f.id===target)))return;
  const count=state.checked.size;
  state.saved.forEach(e=>{if(state.checked.has(e.id))e.folderId=target||null;});
  const stored=persist();renderLibrary();if(stored)notify(count+' accord'+(count>1?'s déplacés.':' déplacé.'));
}
function shareSelection(){
  try{
    const title=state.folders.find(f=>f.id===state.folder)?.name||'';
    const visible=filteredChords(),selected=visible.filter(e=>state.checked.has(e.id));
    $('share-url').value=createShareURL(location.href,selected.length?selected:visible,title);
    copyShare();
  }catch(e){notify(e.message,true);}
}
async function copyShare(){
  try{await navigator.clipboard.writeText($('share-url').value);$('share-result').hidden=true;notify('Lien copié.');}
  catch{$('share-result').hidden=false;$('share-url').focus();$('share-url').select();notify('Sélectionnez le lien, puis copiez-le avec Ctrl+C ou le menu de votre appareil.');}
}
function openShared(){
  if(sharedHash===location.hash){renderShared();return;}
  sharedHash=location.hash;shared=null;sharedChecked.clear();
  try{shared=readShare(location.hash);sharedChecked=new Set(shared.chords.map(e=>e.id));}
  catch(e){$('shared-error').textContent=e.message;}
  $('shared-folder').innerHTML=folderOptions()+'<option value="_new">Nouveau dossier…</option>';
  const existing=shared?.title&&state.folders.find(f=>f.name.toLocaleLowerCase('fr')===shared.title.toLocaleLowerCase('fr'));
  $('shared-folder').value=existing?existing.id:shared?.title?'_new':'';
  $('shared-folder-name').value=shared?.title||'';updateSharedFolder();renderShared();
}
function updateSharedFolder(){$('shared-folder-name').hidden=$('shared-folder').value!=='_new';}
function renderShared(){
  $('shared-error').hidden=!!shared;$('shared-controls').hidden=!shared;
  $('shared-title').textContent=shared?.title||'Accords partagés';
  $('shared-grid').innerHTML=shared?shared.chords.map(e=>cardMarkup(e,true)).join(''):'';
  $('shared-count').textContent=sharedChecked.size+' / '+(shared?.chords.length||0)+' sélectionnés';
  $('import-shared').disabled=!sharedChecked.size;
  $('shared-select-all').checked=!!shared&&sharedChecked.size===shared.chords.length;
  $('shared-select-all').indeterminate=!!sharedChecked.size&&sharedChecked.size<shared.chords.length;
}
function importShared(){
  if(!shared||!sharedChecked.size)return;
  try{
    let target=$('shared-folder').value,newFolder=null;
    if(target==='_new'){
      const name=folderName($('shared-folder-name').value);if(!name)throw Error('Indiquez le nom du nouveau dossier.');
      const existing=state.folders.find(f=>f.name.toLocaleLowerCase('fr')===name.toLocaleLowerCase('fr'));
      if(existing)target=existing.id;
      else{if(state.folders.length>=100)throw Error('Le carnet contient déjà 100 dossiers.');newFolder={id:crypto.randomUUID(),name};target=newFolder.id;}
    }else if(target&&!state.folders.some(f=>f.id===target))throw Error('Ce dossier n’existe plus. Choisissez un autre dossier.');
    const signatures=new Set(state.saved.filter(e=>(e.folderId||'')===target).map(chordSignature));
    const incoming=shared.chords.filter(e=>sharedChecked.has(e.id)).filter(e=>{const key=chordSignature(e);if(signatures.has(key))return false;signatures.add(key);return true;}).map(e=>({...e,id:crypto.randomUUID(),folderId:target||null,createdAt:new Date().toISOString()}));
    if(state.saved.length+incoming.length>500)throw Error('Le carnet ne peut pas dépasser 500 accords.');
    if(!incoming.length){notify('Ces accords sont déjà dans ce dossier.');return;}
    if(newFolder)state.folders.push(newFolder);
    state.saved.unshift(...incoming);state.folder=target;state.saveFolder=target;state.checked=new Set(incoming.map(e=>e.id));
    const stored=persist();renderLibrary();location.hash='carnet';
    if(stored)notify(incoming.length+' accord'+(incoming.length>1?'s ajoutés au carnet.':' ajouté au carnet.'));
  }catch(e){notify(e.message,true);}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function exportPDF(){try{const entries=state.saved.filter(e=>state.checked.has(e.id));if(!entries.length)return;download(new Blob([createChordPDF(entries)],{type:'application/pdf'}),'ChordsMaster-carnet.pdf');notify('Votre fiche PDF est prête.');}catch(error){console.error(error);notify('Le PDF n’a pas pu être généré. Votre carnet reste disponible.',true);}}
async function importJSON(file){
  if(!file)return;
  try{
    if(file.size>2_000_000)throw Error('Fichier trop volumineux (2 Mo maximum).');
    const incoming=readNotebook(JSON.parse(await file.text())),merged=mergeNotebook(currentNotebook(),incoming);
    state.saved=merged.chords;state.folders=merged.folders;state.folder='all';state.checked=new Set(merged.added.map(e=>e.id));
    const stored=persist();renderLibrary();if(stored)notify(merged.added.length+' accord'+(merged.added.length>1?'s importés.':' importé.'));
  }catch(e){notify(e.message||'Impossible de lire cette sauvegarde.',true);}finally{$('import-file').value='';}
}
function navigate(){const library=location.hash==='#carnet',sharing=location.hash.startsWith('#partage=');$('atelier-page').hidden=library||sharing;$('carnet-page').hidden=!library;$('partage-page').hidden=!sharing;document.querySelectorAll('[data-page]').forEach(a=>a.classList.toggle('active',!sharing&&a.dataset.page===(library?'carnet':'atelier')));if(library)renderLibrary();if(sharing)openShared();}

$('tuning-select').innerHTML=TUNINGS.map(t=>`<option value="${t.id}">${t.name} · ${t.notes.map(n=>noteName(n)).join(' ')}</option>`).join('')+'<option value="custom">Personnalisé…</option>';
$('tuning-select').addEventListener('change',changeTuning);
$('custom-strings').addEventListener('change',e=>{if(e.target.dataset.customString!==undefined){state.tuning[Number(e.target.dataset.customString)]=Number(e.target.value);state.transpose=0;state.chosenKey=null;update();}});
$('fret-range').addEventListener('change',e=>{state.range=e.target.value;renderGuitar();});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>chooseMode(b.dataset.mode)));
document.querySelector('.instrument-tabs').addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();chooseMode(state.mode==='guitar'?'piano':'guitar');$(state.mode+'-tab').focus();}});
$('fretboard').addEventListener('click',e=>{
  const cell=e.target.closest('[data-string]'),mute=e.target.closest('[data-mute]');
  if(cell){const s=Number(cell.dataset.string),f=Number(cell.dataset.fret);state.frets[s]=state.frets[s]===f?null:f;}
  else if(mute)state.frets[Number(mute.dataset.mute)]=null;
  else return;
  state.transpose=0;state.chosenKey=null;update();
});
$('fretboard').addEventListener('keydown',e=>{const b=e.target.closest('[data-string]');if(!b||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();let s=Number(b.dataset.string),f=Number(b.dataset.fret);if(e.key==='ArrowLeft'||e.key==='ArrowRight'){const visible=[0,...Array.from({length:state.range==='all'?24:12},(_,i)=>i+1+(state.range==='all'?0:Number(state.range)))];const next=visible.indexOf(f)+(e.key==='ArrowRight'?1:-1);f=visible[Math.max(0,Math.min(visible.length-1,next))];}else s=Math.max(0,Math.min(5,s+(e.key==='ArrowUp'?1:-1)));$('fretboard').querySelector(`[data-string="${s}"][data-fret="${f}"]`)?.focus();});
$('piano').addEventListener('click',e=>{
  const key=e.target.closest('[data-midi]');if(!key)return;
  if(state.mode==='guitar')chooseMode('piano');
  const midi=Number(key.dataset.midi),index=state.pianoNotes.indexOf(midi);
  if(index>=0)state.pianoNotes.splice(index,1);
  else if(state.pianoNotes.length<6)state.pianoNotes.push(midi);
  else{notify('Six notes sont déjà sélectionnées. Retirez-en une pour en choisir une autre.',true);return;}
  state.transpose=0;state.chosenKey=null;update();
});
$('piano').addEventListener('keydown',e=>{const b=e.target.closest('[data-midi]');if(!b||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();$('piano').querySelector(`[data-midi="${Number(b.dataset.midi)+(e.key==='ArrowRight'?1:-1)}"]`)?.focus();});
$('show-notes').addEventListener('change',e=>{state.showNotes=e.target.checked;renderGuitar();});
$('piano-labels').addEventListener('change',e=>{state.pianoLabels=e.target.checked;renderPiano();});
$('clear-button').addEventListener('click',()=>{state.frets=Array(6).fill(null);state.pianoNotes=[];state.transpose=0;state.chosenKey=null;update();});
$('chord-alternative').addEventListener('change',e=>{state.chosenKey=e.target.value;update();});
$('notation').addEventListener('change',e=>{state.french=e.target.value==='fr';update();});
$('accidentals').addEventListener('change',e=>{state.preference=e.target.value;if(state.tuningId==='custom')renderCustomTuning();update();});
$('omit-fifth').addEventListener('change',e=>{state.allowOmit=e.target.checked;update();});
$('transpose-down').addEventListener('click',()=>transpose(-1));$('transpose-up').addEventListener('click',()=>transpose(1));
$('transpose-amount').addEventListener('change',e=>{const size=Number(e.target.value);$('transpose-down').setAttribute('aria-label',`Transposer de ${size} demi-ton${size>1?'s':''} vers le grave`);$('transpose-up').setAttribute('aria-label',`Transposer de ${size} demi-ton${size>1?'s':''} vers l’aigu`);});
$('play-button').addEventListener('click',()=>playChord());$('save-button').addEventListener('click',saveChord);
$('guide-button').addEventListener('click',()=>$('guide-dialog').showModal());$('close-guide').addEventListener('click',()=>$('guide-dialog').close());
$('guide-dialog').addEventListener('click',e=>{if(e.target===$('guide-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('library-grid').addEventListener('change',e=>{
  if(e.target.dataset.select){const id=e.target.dataset.select;e.target.checked?state.checked.add(id):state.checked.delete(id);renderLibrary();}
  else if(e.target.dataset.title){const entry=state.saved.find(item=>item.id===e.target.dataset.title);if(entry){entry.title=e.target.value.trim()||'Mon accord';persist();}}
});
$('library-grid').addEventListener('input',e=>{
  if(!e.target.dataset.title)return;
  const entry=state.saved.find(item=>item.id===e.target.dataset.title);
  if(entry){entry.title=e.target.value.slice(0,80)||'Mon accord';persist();}
});
$('library-grid').addEventListener('click',e=>{const load=e.target.closest('[data-load]'),play=e.target.closest('[data-play]'),del=e.target.closest('[data-delete]');if(load)loadChord(state.saved.find(s=>s.id===load.dataset.load));else if(play)playChord(state.saved.find(s=>s.id===play.dataset.play).notes);else if(del)deleteEntry(del.dataset.delete);});
$('select-all').addEventListener('change',e=>{state.checked=e.target.checked?new Set(filteredChords().map(s=>s.id)):new Set();renderLibrary();});
$('folder-filter').addEventListener('change',e=>{state.folder=e.target.value;if(state.folder!=='all')state.saveFolder=state.folder;state.checked.clear();$('folder-form').hidden=true;$('share-result').hidden=true;renderLibrary();});
$('save-folder').addEventListener('change',e=>{state.saveFolder=e.target.value;});
$('new-folder').addEventListener('click',()=>editFolder());$('rename-folder').addEventListener('click',()=>editFolder(true));
$('folder-form').addEventListener('submit',commitFolder);$('cancel-folder').addEventListener('click',()=>{$('folder-form').hidden=true;$('new-folder').focus();});
$('folder-name').addEventListener('keydown',e=>{if(e.key==='Escape'){$('folder-form').hidden=true;$('new-folder').focus();}});
$('delete-folder').addEventListener('click',removeFolder);$('move-folder').addEventListener('change',e=>moveSelection(e.target.value));
$('share-button').addEventListener('click',shareSelection);$('copy-share').addEventListener('click',copyShare);$('close-share').addEventListener('click',()=>{$('share-result').hidden=true;$('share-button').focus();});
$('shared-folder').addEventListener('change',updateSharedFolder);$('import-shared').addEventListener('click',importShared);
$('shared-select-all').addEventListener('change',e=>{sharedChecked=e.target.checked?new Set(shared.chords.map(e=>e.id)):new Set();renderShared();});
$('shared-grid').addEventListener('change',e=>{const id=e.target.dataset.sharedSelect;if(id){e.target.checked?sharedChecked.add(id):sharedChecked.delete(id);renderShared();}});
$('shared-grid').addEventListener('click',e=>{const load=e.target.closest('[data-shared-load]'),play=e.target.closest('[data-shared-play]');if(load)loadChord(shared.chords.find(s=>s.id===load.dataset.sharedLoad));else if(play)playChord(shared.chords.find(s=>s.id===play.dataset.sharedPlay).notes);});
$('export-pdf').addEventListener('click',exportPDF);
$('backup-button').addEventListener('click',()=>download(new Blob([JSON.stringify({...currentNotebook(),exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),'ChordsMaster-sauvegarde.json'));
$('import-button').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',e=>importJSON(e.target.files[0]));
window.addEventListener('hashchange',navigate);
window.addEventListener('storage',e=>{if(e.key!==STORAGE)return;endLibraryDrag();readStorage();renderLibrary();if(location.hash.startsWith('#partage=')){sharedHash='';openShared();}});
readStorage();renderLibrary();update();navigate();
