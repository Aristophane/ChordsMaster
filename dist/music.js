// Equal temperament; MIDI C4 = 60. Pitch classes name harmony, MIDI names bass.
export const mod = n => ((n % 12) + 12) % 12;
export const SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const FR = { C:'Do', D:'Ré', E:'Mi', F:'Fa', G:'Sol', A:'La', B:'Si' };
export function noteName(midi, preference = 'sharp', french = false, octave = false) {
  let name = (preference === 'flat' ? FLATS : SHARPS)[mod(midi)];
  if (french) name = FR[name[0]] + name.slice(1);
  return name + (octave ? Math.floor(midi / 12) - 1 : '');
}
export const TUNINGS = [
  { id:'standard', name:'Standard', notes:[40,45,50,55,59,64], description:'Mi · La · Ré · Sol · Si · Mi' },
  { id:'drop-d', name:'Drop D', notes:[38,45,50,55,59,64], description:'Ré · La · Ré · Sol · Si · Mi' },
  { id:'drop-c', name:'Drop C', notes:[36,43,48,53,57,62], description:'Do · Sol · Do · Fa · La · Ré' },
  { id:'open-d', name:'Open D', notes:[38,45,50,54,57,62], description:'Ré · La · Ré · Fa♯ · La · Ré' },
  { id:'open-g', name:'Open G', notes:[38,43,50,55,59,62], description:'Ré · Sol · Ré · Sol · Si · Ré' },
  { id:'open-e', name:'Open E', notes:[40,47,52,56,59,64], description:'Mi · Si · Mi · Sol♯ · Si · Mi' },
  { id:'open-a', name:'Open A', notes:[40,45,52,57,61,64], description:'Mi · La · Mi · La · Do♯ · Mi' },
  { id:'dadgad', name:'DADGAD', notes:[38,45,50,55,57,62], description:'Ré · La · Ré · Sol · La · Ré' },
  { id:'half-down', name:'Standard − ½ ton', notes:[39,44,49,54,58,63], description:'Mi♭ · La♭ · Ré♭ · Sol♭ · Si♭ · Mi♭' },
  { id:'d-standard', name:'Standard en Ré', notes:[38,43,48,53,57,62], description:'Ré · Sol · Do · Fa · La · Ré' }
];

const definitions = [];
const add = (suffix, title, pairs, priority = 0) => definitions.push({ suffix, title, intervals:pairs.map(p=>p[0]), degrees:pairs.map(p=>p[1]), priority });
const P = { major:[[0,'1'],[4,'3'],[7,'5']], minor:[[0,'1'],[3,'♭3'],[7,'5']], dim:[[0,'1'],[3,'♭3'],[6,'♭5']], aug:[[0,'1'],[4,'3'],[8,'♯5']], sus2:[[0,'1'],[2,'2'],[7,'5']], sus4:[[0,'1'],[5,'4'],[7,'5']] };
add('', 'majeur', P.major);
add('m', 'mineur', P.minor);
add('dim', 'diminué', P.dim, 2);
add('aug', 'augmenté', P.aug, 2);
add('sus2', 'suspendu de seconde', P.sus2, 3);
add('sus4', 'suspendu de quarte', P.sus4, 3);
add('5', 'accord de quinte (power chord)', [[0,'1'],[7,'5']], 4);
const sevenths = [
  ['7','septième de dominante',P.major,[10,'♭7']],
  ['maj7','majeur septième',P.major,[11,'7']],
  ['m7','mineur septième',P.minor,[10,'♭7']],
  ['m(maj7)','mineur à septième majeure',P.minor,[11,'7']],
  ['m7♭5','demi-diminué',P.dim,[10,'♭7']],
  ['dim7','septième diminuée',P.dim,[9,'♭♭7']],
  ['7♯5','dominante à quinte augmentée',P.aug,[10,'♭7']],
  ['maj7♯5','majeur septième à quinte augmentée',P.aug,[11,'7']],
  ['7sus4','septième suspendue de quarte',P.sus4,[10,'♭7']],
  ['7sus2','septième suspendue de seconde',P.sus2,[10,'♭7']]
];
for (const [s,t,p,sev] of sevenths) add(s,t,[...p,sev],s==='dim7'?2:1);
add('6','majeur sixte',[...P.major,[9,'6']],2);
add('m6','mineur sixte',[...P.minor,[9,'6']],2);
add('6/9','majeur sixte et neuvième',[...P.major,[9,'6'],[2,'9']],3);
add('m6/9','mineur sixte et neuvième',[...P.minor,[9,'6'],[2,'9']],3);
for (const [s,t,p] of [['','majeur',P.major],['m','mineur',P.minor]]) {
  for (const [n,i,d] of [['9',2,'9'],['11',5,'11'],['♯11',6,'♯11']]) add(s+'add'+n,t+' avec '+n+' ajoutée',[...p,[i,d]],4);
}
for (const [s,t,p,sev] of sevenths.filter(s=>['7','maj7','m7','m(maj7)'].includes(s[0]))) {
  const prefix = s==='7'?'':s==='maj7'?'maj':s==='m7'?'m':'m(maj';
  const suffix9 = s==='m(maj7)'?'m(maj9)':prefix+'9';
  add(suffix9,t+' et neuvième',[...p,sev,[2,'9']],3);
  const suffix11 = s==='m(maj7)'?'m(maj11)':prefix+'11';
  add(suffix11,t+' avec neuvième et onzième',[...p,sev,[2,'9'],[5,'11']],5);
  // 13 includes the ninth; the natural 11 is conventionally omitted here.
  const suffix13 = s==='m(maj7)'?'m(maj13)':prefix+'13';
  add(suffix13,t+' avec neuvième et treizième (sans 11)',[...p,sev,[2,'9'],[9,'13']],5);
  add(s+'(add13)',t+' avec treizième ajoutée',[...p,sev,[9,'13']],6);
  add(s+'(add11)',t+' avec onzième ajoutée',[...p,sev,[5,'11']],6);
  add(s+'(♯11)',t+' avec onzième augmentée',[...p,sev,[6,'♯11']],5);
  add(suffix9+'(♯11)',t+' avec neuvième et onzième augmentée',[...p,sev,[2,'9'],[6,'♯11']],6);
}
for (const [suffix,extra] of [
  ['7(♭9)',[[1,'♭9']]],['7(♯9)',[[3,'♯9']]],['7(♭5)',[]],
  ['7(♭13)',[[8,'♭13']]],['7(♭9,♭13)',[[1,'♭9'],[8,'♭13']]],
  ['7(♭9,♯11)',[[1,'♭9'],[6,'♯11']]],['7(♯9,♯11)',[[3,'♯9'],[6,'♯11']]],
  ['7(♯5,♭9)',[[1,'♭9']]],['7(♯5,♯9)',[[3,'♯9']]]
]) {
  const triad=suffix.includes('♭5')?[[0,'1'],[4,'3'],[6,'♭5']]:suffix.includes('♯5')?P.aug:P.major;
  add(suffix,'dominante altérée',[...triad,[10,'♭7'],...extra],5);
}
add('9sus4','neuvième suspendue de quarte',[...P.sus4,[10,'♭7'],[2,'9']],4);
add('7sus4(♭9)','septième suspendue avec neuvième mineure',[...P.sus4,[10,'♭7'],[1,'♭9']],5);
export const CHORDS = definitions;

const LETTERS = ['C','D','E','F','G','A','B'];
const NATURAL = [0,2,4,5,7,9,11];
export function spellDegree(root, degree) {
  const step = Number(degree.replace(/[^0-9]/g,''));
  const accidentals = [...degree].reduce((a,c)=>a+(c==='♭'?-1:c==='♯'?1:0),0);
  const rootIdx=LETTERS.indexOf(root[0]);
  const rootAcc=[...root.slice(1)].reduce((a,c)=>a+(c==='♭'?-1:c==='♯'?1:0),0);
  const diatonic=(step-1)%7;
  const target=mod(NATURAL[rootIdx]+rootAcc+NATURAL[diatonic]+accidentals);
  const letterIdx=(rootIdx+diatonic)%7;
  let alteration=mod(target-NATURAL[letterIdx]);
  if(alteration>6) alteration-=12;
  return LETTERS[letterIdx]+(alteration>0?'♯'.repeat(alteration):'♭'.repeat(-alteration));
}
export const frenchName = name => FR[name[0]]+name.slice(1);
export function spelledOctave(name, midi) {
  const letter=LETTERS.indexOf(name[0]);
  const alteration=[...name.slice(1)].reduce((n,c)=>n+(c==='♯'?1:c==='♭'?-1:0),0);
  return (midi-NATURAL[letter]-alteration)/12-1;
}
export function analyze(notes, preference='sharp', allowOmit=true) {
  if(!notes.length) return { notes:[], candidates:[], kind:'empty' };
  const sorted=[...notes].sort((a,b)=>a-b);
  const pcs=[...new Set(sorted.map(mod))];
  const bass=mod(sorted[0]);
  const candidates=[];
  for(const root of pcs) {
    const actual=pcs.map(n=>mod(n-root));
    for(const chord of CHORDS) {
      const missing=chord.intervals.filter(n=>!actual.includes(n));
      const exact=!missing.length && actual.length===chord.intervals.length;
      const omit=allowOmit && pcs.length>=3 && missing.length===1 && missing[0]===7 && chord.intervals.includes(7) && actual.every(n=>chord.intervals.includes(n));
      if(!exact&&!omit) continue;
      const rootName=noteName(root,preference);
      const tones=chord.intervals.map((interval,i)=>({pc:mod(root+interval),interval,degree:chord.degrees[i],name:spellDegree(rootName,chord.degrees[i]),present:actual.includes(interval)}));
      const bassTone=tones.find(t=>t.pc===bass);
      const bassName=bassTone?.name||noteName(bass,preference);
      const symbol=rootName+chord.suffix+(bass!==root?'/'+bassName:'');
      const score=(omit?30:0)+(bass===root?0:4)+chord.priority;
      candidates.push({ ...chord, root, rootName, bass, bassName, symbol, tones, omitted:omit?['5']:[], score,
        key:root+':'+chord.suffix+':'+(omit?'no5':'full'),
        inversion:bass===root?'État fondamental':bassTone?.degree==='3'||bassTone?.degree==='♭3'?'1er renversement':bassTone?.degree.includes('5')?'2e renversement':bassTone?.degree.includes('7')?'3e renversement':'Basse sur '+(bassTone?.degree||bassName)
      });
    }
  }
  candidates.sort((a,b)=>a.score-b.score||a.root-b.root);
  return {notes:sorted, pcs, bass, candidates, kind:candidates.length?'chord':pcs.length===1?'single':pcs.length===2?'interval':'unknown'};
}
export function guitarNotes(frets,tuning) { return frets.flatMap((f,s)=>f===null?[]:[tuning[s]+f]); }

// Exact MIDI assignment only, one note per string. Preserve doublings and bass.
export function findFingering(notes,tuning,previous=Array(6).fill(null),maxFret=24) {
  if(notes.length>6) return null;
  const choices=notes.map((n,index)=>({index,options:tuning.flatMap((open,s)=>n-open>=0&&n-open<=maxFret?[{s,f:n-open}]:[])})).sort((a,b)=>a.options.length-b.options.length);
  if(choices.some(c=>!c.options.length)) return null;
  let best=null,bestCost=Infinity;
  const frets=Array(6).fill(null);
  function visit(i,cost) {
    if(cost>bestCost) return;
    if(i===choices.length) {
      const used=frets.filter(f=>f!==null&&f>0);
      const span=used.length?Math.max(...used)-Math.min(...used):0;
      const total=cost+span*4;
      if(total<bestCost){bestCost=total;best=[...frets];}
      return;
    }
    for(const {s,f} of choices[i].options) if(frets[s]===null) {
      frets[s]=f;
      visit(i+1,cost+f*.2+(previous[s]===null?1:Math.abs(previous[s]-f)*.3));
      frets[s]=null;
    }
  }
  visit(0,0);
  return best;
}
export function transposeGuitar(frets,tuning,semitones) {
  const shifted=frets.map(f=>f===null?null:f+semitones);
  if(shifted.every(f=>f===null||(f>=0&&f<=24))) return shifted;
  return findFingering(guitarNotes(frets,tuning).map(n=>n+semitones),tuning,frets);
}
export const INTERVAL_NAMES = ['Unisson','Seconde mineure','Seconde majeure','Tierce mineure','Tierce majeure','Quarte juste','Triton','Quinte juste','Sixte mineure','Sixte majeure','Septième mineure','Septième majeure'];
export function intervalName(notes) {
  const pcs=[...new Set([...notes].sort((a,b)=>a-b).map(mod))];
  return pcs.length===2?INTERVAL_NAMES[mod(pcs[1]-pcs[0])]:'Unisson / octaves';
}
