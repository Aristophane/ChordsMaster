import { mod, TUNINGS, noteName, frenchName, spelledOctave, analyze, guitarNotes, findFingering, transposeGuitar, intervalName } from './music.js';
import { createChordPDF } from './pdf.js';

const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='chordsmaster.carnet.v1';
const state={mode:'guitar',tuningId:'standard',tuning:[40,45,50,55,59,64],frets:[null,3,2,0,0,0],pianoNotes:[],preference:'sharp',french:true,allowOmit:true,chosenKey:null,transpose:0,range:0,showNotes:false,pianoLabels:true,saved:[],checked:new Set()};
let result, chosen, audioContext, toastTimer, pendingDeletion;
let storageUnreadable=false;
const tuningLabel=()=>state.tuningId==='custom'?'Personnalisé':TUNINGS.find(t=>t.id===state.tuningId)?.name||'Personnalisé';
const notes=()=>state.mode==='guitar'?guitarNotes(state.frets,state.tuning):[...state.pianoNotes];
const displayNote=(n,octave=false)=>noteName(n,state.preference,state.french,octave);
const toneName=name=>state.french?frenchName(name):name;

function notify(message,error=false,undo=false){
  clearTimeout(toastTimer);
  $('toast').classList.toggle('error',error);
  $('toast').textContent=message;
  if(undo){const button=document.createElement('button');button.textContent='Annuler';button.style.cssText='color:inherit;text-decoration:underline;margin-left:15px';button.onclick=undoDelete;$('toast').append(button);}
  $('toast').hidden=false;
  toastTimer=setTimeout(()=>{$('toast').hidden=true;pendingDeletion=null;},undo?9000:4500);
}

function validateEntry(entry){
  if(!entry||typeof entry!=='object'||!Array.isArray(entry.notes)||entry.notes.length<1||entry.notes.length>6||!entry.notes.every(n=>Number.isInteger(n)&&n>=24&&n<=107))return null;
  if(!Array.isArray(entry.tuning)||entry.tuning.length!==6||!entry.tuning.every(n=>Number.isInteger(n)&&n>=28&&n<=71))return null;
  if(!Array.isArray(entry.frets)||entry.frets.length!==6||!entry.frets.every(f=>f===null||(Number.isInteger(f)&&f>=0&&f<=24)))return null;
  if(entry.mode!=='guitar'&&entry.mode!=='piano')return null;
  if(entry.mode==='guitar'&&JSON.stringify([...guitarNotes(entry.frets,entry.tuning)].sort((a,b)=>a-b))!==JSON.stringify([...entry.notes].sort((a,b)=>a-b)))return null;
  return {id:typeof entry.id==='string'?entry.id.slice(0,100):crypto.randomUUID(),title:typeof entry.title==='string'?entry.title.slice(0,80):'Mon accord',notes:[...entry.notes],tuning:[...entry.tuning],frets:[...entry.frets],mode:entry.mode,tuningId:TUNINGS.some(t=>t.id===entry.tuningId)?entry.tuningId:'custom',preference:entry.preference==='flat'?'flat':'sharp',allowOmit:entry.allowOmit!==false,chordKey:typeof entry.chordKey==='string'?entry.chordKey.slice(0,100):null,createdAt:typeof entry.createdAt==='string'?entry.createdAt:new Date().toISOString()};
}
function readStorage(){
  try {const raw=localStorage.getItem(STORAGE);if(!raw)return;const data=JSON.parse(raw);if(!Array.isArray(data)||data.length>500)throw Error();state.saved=data.map(validateEntry);if(state.saved.some(x=>!x))throw Error();state.saved=state.saved.filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i);}
  catch{state.saved=[];storageUnreadable=true;setTimeout(()=>notify('Le carnet existant est illisible ou inaccessible. Exportez vos nouvelles idées en JSON avant de fermer.',true),300);}
}
function persist(){
  if(storageUnreadable){notify('La sauvegarde locale est inaccessible. Utilisez la sauvegarde JSON pour garder votre carnet.',true);return false;}
  try{localStorage.setItem(STORAGE,JSON.stringify(state.saved));return true;}catch{notify('La sauvegarde locale est indisponible ou pleine. Votre carnet peut être exporté en JSON.',true);return false;}
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
  $('piano-eyebrow').textContent=state.mode==='piano'?'CLIQUEZ SUR LES TOUCHES POUR COMPOSER':'LES MÊMES NOTES, UN AUTRE REGARD';
  const mapped=state.mode==='guitar'?state.frets:findFingering(current,state.tuning,state.frets);
  $('piano-mapping').textContent=current.length?(mapped?'Une position exacte est disponible sur la guitare.':'Ces hauteurs ne tiennent pas sur six cordes dans cet accordage. Votre accord reste disponible au piano.'):'Choisissez une première note sur le clavier.';
  $('position-notation').innerHTML=state.mode==='guitar'?state.frets.map((f,i)=>`<span class="${f===null?'':'played'}" title="Corde ${6-i}">${f===null?'×':f}</span>`).join(''):[...current].sort((a,b)=>a-b).map(n=>`<span class="played">${esc(displayNote(n,true))}</span>`).join('');
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
    symbol.textContent=chosen.symbol;
    symbol.classList.toggle('long-symbol',chosen.symbol.length>9);
    $('chord-title').textContent=frenchName(chosen.rootName)+' '+chosen.title;
    $('chord-inversion').textContent=chosen.inversion;
    $('chord-inversion').hidden=false;
    $('tone-list').innerHTML=chosen.tones.filter(t=>t.present).map(t=>`<span class="tone ${t.degree==='1'?'root':''}"><strong>${esc(toneName(t.name))}</strong><small>${esc(t.degree)}</small></span>`).join('');
    $('omission-note').hidden=!chosen.omitted.length;
    $('omission-note').textContent='Quinte juste omise · sans 5';
  }else{
    symbol.classList.add('unknown-symbol');
    symbol.textContent=result.kind==='empty'?'À vous de jouer.':result.kind==='single'?displayNote(result.notes[0]):result.kind==='interval'?intervalName(result.notes):'Notes libres';
    $('chord-title').textContent=result.kind==='empty'?'Choisissez quelques notes sur un instrument.':result.kind==='single'?'Une hauteur de note, éventuellement doublée à l’octave.':result.kind==='interval'?'Deux classes de hauteur : un intervalle, sans triade complète.':'Aucun accord du catalogue ne décrit exactement ces notes. Explorez une autre note ou un autre contexte.';
    $('chord-inversion').hidden=true;
    $('tone-list').innerHTML=(result.pcs||[]).map(pc=>`<span class="tone"><strong>${esc(displayNote(pc))}</strong><small>note</small></span>`).join('');
    $('omission-note').hidden=true;
  }
  const bass=result.notes[0];
  const bassSpelling=chosen?.tones.find(t=>t.pc===mod(bass))?.name;
  $('bass-note').innerHTML=bass===undefined?'—':`${esc(bassSpelling?toneName(bassSpelling):displayNote(bass))}${bassSpelling?spelledOctave(bassSpelling,bass):Math.floor(bass/12)-1} <span>(${esc(noteName(bass,state.preference,false,true))})</span>`;
  $('alternatives').hidden=result.candidates.length<2;
  $('chord-alternative').innerHTML=result.candidates.map(c=>`<option value="${esc(c.key)}" ${c.key===chosen?.key?'selected':''}>${esc(c.symbol)}${c.omitted.length?' · sans 5':''}</option>`).join('');
  $('mobile-symbol').textContent=symbol.textContent;
  $('mobile-title').textContent=chosen?frenchName(chosen.rootName)+' '+chosen.title:result.kind==='unknown'?'Aucune lecture exacte du catalogue':result.kind==='empty'?'Choisissez vos premières notes':'Vos notes sélectionnées';
}

function labelForMidi(midi,withOctave=false){
  const spelled=chosen?.tones.find(t=>t.pc===mod(midi))?.name;
  return (spelled?toneName(spelled):displayNote(midi))+(withOctave?(spelled?spelledOctave(spelled,midi):Math.floor(midi/12)-1):'');
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
  $('piano-range-label').textContent=displayNote(start,true)+' — '+displayNote(end,true)+' · octaves scientifiques';
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
  const entry={id:crypto.randomUUID(),title:chosen?frenchName(chosen.rootName)+' '+chosen.title:result.kind==='single'?displayNote(result.notes[0]):result.kind==='interval'?intervalName(result.notes):'Notes libres',notes:notes(),mode:state.mode,tuningId:state.tuningId,tuning:[...state.tuning],frets:state.mode==='guitar'?[...state.frets]:findFingering(notes(),state.tuning,state.frets)||Array(6).fill(null),chordKey:chosen?.key||null,preference:state.preference,allowOmit:state.allowOmit,createdAt:new Date().toISOString()};
  const signature=e=>JSON.stringify([e.mode,e.tuning,[...e.notes].sort((a,b)=>a-b),e.frets,e.chordKey]);
  if(state.saved.some(e=>signature(e)===signature(entry))){notify('Cet accord et cette position sont déjà dans votre carnet.');return;}
  state.saved.unshift(entry);state.checked.add(entry.id);
  const stored=persist();renderLibrary();update();
  if(stored)notify('Accord gardé dans votre carnet.');
}
function entryAnalysis(entry){const a=analyze(entry.notes,entry.preference,entry.allowOmit);return {a,c:a.candidates.find(c=>c.key===entry.chordKey)||a.candidates[0]||null};}
function miniGuitar(entry,c){
  const playable=entry.frets.some(f=>f!==null);
  if(!playable)return '<svg class="mini-guitar" viewBox="0 0 86 109" aria-label="Accord créé au piano"><path d="M5 25h76v52H5zM16 25v52m11-52v52m11-52v52m11-52v52m11-52v52m11-52v52" stroke="#c7c6b9"/><path d="M13 25v30h8V25m4 0v30h8V25m17 0v30h8V25m4 0v30h8V25" fill="#3d4138" stroke="none"/><text x="43" y="96" text-anchor="middle">PIANO</text></svg>';
  const used=entry.frets.filter(f=>f!==null&&f>0),min=used.length?Math.min(...used):1,max=used.length?Math.max(...used):4;
  const start=max<=4?1:min,rows=Math.max(4,max-start+1),height=68,step=height/rows;
  let svg=`<svg class="mini-guitar" viewBox="0 0 86 109" aria-label="Position ${esc(entry.frets.map(f=>f===null?'x':f).join(' '))}">`;
  for(let s=0;s<6;s++)svg+=`<path d="M${18+s*11} 25v68" stroke="#b9b8aa"/>`;
  for(let f=0;f<=rows;f++)svg+=`<path d="M18 ${25+f*step}h55" stroke="#c6c5b8" ${f===0&&start===1?'stroke-width="3"':''}/>`;
  if(start>1)svg+=`<text x="3" y="${25+step*.7}">${start}</text>`;
  entry.frets.forEach((f,s)=>{const x=18+s*11;if(f===null)svg+=`<text x="${x}" y="16" text-anchor="middle">×</text>`;else if(f===0)svg+=`<text x="${x}" y="16" text-anchor="middle">○</text>`;else svg+=`<circle class="${c&&mod(entry.tuning[s]+f)===c.root?'root':''}" cx="${x}" cy="${25+(f-start+.5)*step}" r="${Math.min(4,step*.38)}"/>`;svg+=`<text x="${x}" y="105" text-anchor="middle">${f===null?'×':f}</text>`;});
  return svg+'</svg>';
}
function renderLibrary(){
  $('saved-count').textContent=state.saved.length;
  state.checked=new Set([...state.checked].filter(id=>state.saved.some(e=>e.id===id)));
  $('library-count').textContent=state.saved.length+' accord'+(state.saved.length>1?'s':'');
  $('library-empty').hidden=state.saved.length>0;
  $('export-count').textContent=state.checked.size;
  $('export-pdf').disabled=!state.checked.size;
  $('backup-button').disabled=!state.saved.length;
  $('select-all').checked=!!state.saved.length&&state.checked.size===state.saved.length;
  $('select-all').indeterminate=state.checked.size>0&&state.checked.size<state.saved.length;
  $('select-all').disabled=!state.saved.length;
  $('library-grid').innerHTML=state.saved.map(entry=>{
    const {c}=entryAnalysis(entry),symbol=c?.symbol||entry.notes.map(n=>noteName(n,entry.preference)).filter((n,i,a)=>a.indexOf(n)===i).join(' · ');
    const tones=c?c.tones.filter(t=>t.present).map(t=>t.name):[...new Set(entry.notes.map(n=>noteName(n,entry.preference)))];
    return `<article class="saved-card ${state.checked.has(entry.id)?'is-checked':''}" data-id="${esc(entry.id)}"><div class="saved-card-header"><span class="eyebrow">${entry.mode==='guitar'?'GUITARE & PIANO':'PIANO'}${c?.omitted.length?' · SANS 5':''}</span><label><span class="sr-only">Sélectionner ${esc(symbol)} pour le PDF</span><input type="checkbox" data-select="${esc(entry.id)}" ${state.checked.has(entry.id)?'checked':''}></label></div><h2>${esc(symbol)}</h2><input class="saved-title-input" aria-label="Nom personnalisé de l’accord" maxlength="80" data-title="${esc(entry.id)}" value="${esc(entry.title)}"><p class="tuning-caption">${esc(entry.tuningId==='custom'?'Personnalisé':TUNINGS.find(t=>t.id===entry.tuningId)?.name||'Personnalisé')} · ${entry.tuning.map(n=>noteName(n,entry.preference)).join(' – ')}</p><div class="card-diagrams">${miniGuitar(entry,c)}<div><div class="saved-tones">${tones.map(t=>`<span>${esc(t)}</span>`).join('')}</div><p class="saved-midi">${[...entry.notes].sort((a,b)=>a-b).map(n=>noteName(n,entry.preference,false,true)).join(' · ')}${c?'<br>'+esc(c.inversion):''}</p></div></div><div class="saved-actions"><button class="load-chord" data-load="${esc(entry.id)}">Ouvrir dans l’atelier <span aria-hidden="true">↗</span></button><button data-play="${esc(entry.id)}" aria-label="Écouter ${esc(symbol)}"><svg viewBox="0 0 24 24"><path d="m8 4 12 8-12 8V4Z"/></svg></button><button data-delete="${esc(entry.id)}" aria-label="Supprimer ${esc(symbol)}"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg></button></div></article>`;
  }).join('');
}
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
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function exportPDF(){try{const entries=state.saved.filter(e=>state.checked.has(e.id));if(!entries.length)return;download(new Blob([createChordPDF(entries)],{type:'application/pdf'}),'ChordsMaster-carnet.pdf');notify('Votre fiche PDF est prête.');}catch(error){console.error(error);notify('Le PDF n’a pas pu être généré. Votre carnet reste disponible.',true);}}
async function importJSON(file){
  if(!file)return;
  try{
    if(file.size>2_000_000)throw Error('Fichier trop volumineux (2 Mo maximum).');
    const data=JSON.parse(await file.text());if(data.version!==1||!Array.isArray(data.chords)||data.chords.length>500)throw Error('Format de sauvegarde ChordsMaster non reconnu.');
    const entries=data.chords.map(validateEntry);if(entries.some(e=>!e))throw Error('La sauvegarde contient un accord invalide. Aucun accord n’a été importé.');
    const incoming=entries.filter((e,i,a)=>!state.saved.some(s=>s.id===e.id)&&a.findIndex(x=>x.id===e.id)===i);
    if(state.saved.length+incoming.length>500)throw Error('Le carnet ne peut pas dépasser 500 accords.');
    state.saved.unshift(...incoming);incoming.forEach(e=>state.checked.add(e.id));const stored=persist();renderLibrary();if(stored)notify(incoming.length+' accord'+(incoming.length>1?'s importés.':' importé.'));
  }catch(e){notify(e.message||'Impossible de lire cette sauvegarde.',true);}finally{$('import-file').value='';}
}
function navigate(){const library=location.hash==='#carnet';$('atelier-page').hidden=library;$('carnet-page').hidden=!library;document.querySelectorAll('[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===(library?'carnet':'atelier')));if(library)renderLibrary();}

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
$('select-all').addEventListener('change',e=>{state.checked=e.target.checked?new Set(state.saved.map(s=>s.id)):new Set();renderLibrary();});
$('export-pdf').addEventListener('click',exportPDF);
$('backup-button').addEventListener('click',()=>download(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),chords:state.saved},null,2)],{type:'application/json'}),'ChordsMaster-sauvegarde.json'));
$('import-button').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',e=>importJSON(e.target.files[0]));
window.addEventListener('hashchange',navigate);
readStorage();renderLibrary();update();navigate();
