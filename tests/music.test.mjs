import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, guitarNotes, TUNINGS, spellDegree, spelledOctave, findFingering, transposeGuitar, mod, CHORDS, intervalName, chordLabel } from '../dist/music.js';
import { createChordPDF, pdfText } from '../dist/pdf.js';

const standard=TUNINGS[0].notes;
test('Open C major and C major seventh retain duplicated tones',()=>{
  assert.equal(analyze(guitarNotes([null,3,2,0,1,0],standard)).candidates[0].symbol,'C');
  assert.equal(analyze(guitarNotes([null,3,2,0,0,0],standard)).candidates[0].symbol,'Cmaj7');
});
test('The actual lowest MIDI note defines the bass, including reentrant custom tuning',()=>{
  assert.equal(analyze([64,60,55,52]).candidates[0].symbol,'C/E');
  assert.equal(analyze([64,60,55,52]).candidates[0].inversion,'1er renversement');
  assert.equal(analyze([67,72,64,70]).candidates[0].symbol,'C7/E');
});
test('No ninth or seventh is fabricated: add9, 9, maj9 and minor ninth differ',()=>{
  for(const [notes,symbol] of [[[48,52,55,62],'Cadd9'],[[48,52,55,58,62],'C9'],[[48,52,55,59,62],'Cmaj9'],[[48,51,55,58,62],'Cm9']])assert.equal(analyze(notes).candidates[0].symbol,symbol);
});
test('Enharmonic spelling follows diatonic degrees, including double flats',()=>{
  assert.equal(spellDegree('C','♭♭7'),'B♭♭');
  assert.equal(spellDegree('F♯','3'),'A♯');
  assert.equal(spellDegree('G♯','3'),'B♯');
  assert.equal(spellDegree('D♭','♭3'),'F♭');
  assert.equal(spelledOctave('B♯',60),3);
  assert.equal(spelledOctave('C♭',59),4);
  assert.equal(spelledOctave('B♭♭',57),3);
  assert.deepEqual(analyze([48,51,54,57]).candidates.find(c=>c.symbol==='Cdim7').tones.map(t=>t.name),['C','E♭','G♭','B♭♭']);
});
test('Symmetric and sixth/minor-seventh interpretations are exposed',()=>{
  const symbols=analyze([48,52,55,57]).candidates.map(c=>c.symbol);
  assert(symbols.includes('C6'));assert(symbols.includes('Am7/C'));
  assert.equal(analyze([48,51,54,57]).candidates.filter(c=>c.suffix==='dim7').length,4);
  assert.equal(analyze([48,52,56]).candidates.filter(c=>c.suffix==='aug').length,3);
});
test('User-facing chord labels use conventional chromatic bass names',()=>{
  const chord=analyze([41,50,58]).candidates[0];
  assert.equal(chord.symbol,'A♯/E♯');
  assert.equal(chordLabel(chord),'A♯/F');
  assert.equal(chordLabel(chord,'flat'),'B♭/F');
});
test('Omitted fifths require explicit opt-in and never manufacture missing roots or thirds',()=>{
  const c=analyze([48,52,58], 'sharp',true).candidates[0];assert.equal(c.symbol,'C7');assert.deepEqual(c.omitted,['5']);
  assert.equal(analyze([48,52,58],'sharp',false).candidates.length,0);
  assert.equal(analyze([52,55,58]).candidates.some(c=>c.symbol==='C7'),false);
  assert.equal(analyze([48,55,58]).candidates.some(c=>c.suffix==='7'),false);
});
test('Single notes, octaves and arbitrary pitch sets are not given invented chord names',()=>{
  assert.equal(analyze([48,60]).kind,'single');assert.equal(analyze([48,52]).kind,'interval');
  assert.equal(intervalName([48,52,60]),'Tierce majeure');
  assert.equal(analyze([48,49,50,51,52,53]).kind,'unknown');assert.equal(analyze([]).kind,'empty');
});
test('Every catalog chord is recognized in each of twelve roots and every inversion',()=>{
  for(const chord of CHORDS)for(let root=0;root<12;root++)for(const bass of chord.intervals){
    const pitches=chord.intervals.map(i=>48+root+mod(i-bass)+bass);
    // Move the nominated bass below all other chord tones without altering PCs.
    const bassMidi=36+mod(root+bass);const other=pitches.filter(n=>mod(n)!==mod(root+bass));
    const result=analyze([bassMidi,...other]);
    assert(result.candidates.some(c=>c.root===root&&c.suffix===chord.suffix),`${root} ${chord.suffix} bass ${bass}`);
  }
});
test('Tunings correspond to published standard, Drop D, Open D and Open G',()=>{
  assert.deepEqual(TUNINGS.find(t=>t.id==='drop-d').notes,[38,45,50,55,59,64]);
  assert.deepEqual(TUNINGS.find(t=>t.id==='open-d').notes,[38,45,50,54,57,62]);
  assert.deepEqual(TUNINGS.find(t=>t.id==='open-g').notes,[38,43,50,55,59,62]);
  assert.equal(analyze(TUNINGS.find(t=>t.id==='open-d').notes).candidates[0].symbol,'D');
  assert.equal(analyze(TUNINGS.find(t=>t.id==='open-g').notes).candidates[0].symbol,'G/D');
});
test('Exact piano-to-guitar assignment preserves pitches, duplicates and separate strings',()=>{
  const pitches=[48,52,55,59,64,67];const frets=findFingering(pitches,standard);
  assert(frets);assert.deepEqual(guitarNotes(frets,standard).sort((a,b)=>a-b),pitches);
  assert.equal(findFingering([24],standard),null);
  assert.equal(findFingering([40,40,40],standard),null);
  assert.equal(findFingering([48,50,52,53,55,57,59],standard),null);
});
test('Transposition is exact, reversible when possible, and fails atomically at range limits',()=>{
  const frets=[null,3,2,0,0,0];
  for(let delta=-12;delta<=12;delta++){
    const transposed=transposeGuitar(frets,standard,delta);
    if(transposed)assert.deepEqual(guitarNotes(transposed,standard).sort((a,b)=>a-b),guitarNotes(frets,standard).map(n=>n+delta).sort((a,b)=>a-b));
  }
  assert.deepEqual(transposeGuitar(transposeGuitar(frets,standard,2),standard,-2),frets);
  assert.equal(transposeGuitar([0,null,null,null,null,null],standard,-1),null);
  assert.equal(transposeGuitar([null,null,null,null,null,24],standard,1),null);
  assert.deepEqual(frets,[null,3,2,0,0,0]);
});
test('PDF is multi-page, escaped, searchable, and has valid xref offsets',()=>{
  const entry={notes:[48,52,55,59],frets:[null,3,2,0,0,null],tuning:standard,mode:'guitar',title:'Do majeur septième (essai)',preference:'sharp',allowOmit:true,chordKey:'0:maj7:full'};
  const pdf=new TextDecoder().decode(createChordPDF(Array(7).fill(entry)));
  assert(pdf.startsWith('%PDF-1.4'));assert(Number(pdf.match(/\/Count (\d+)/)[1])>1);
  const offset=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(offset,offset+4),'xref');
  const rows=pdf.slice(offset).split('\n').slice(3).filter(l=>/^\d{10} 00000 n/.test(l));
  rows.forEach((r,i)=>assert(pdf.slice(Number(r.slice(0,10))).startsWith(`${i+1} 0 obj`)));
  assert.equal(pdfText('Cdim7 B♭♭ é (x)'),'(Cdim7 Bbb \\351 \\(x\\))');
});
test('PDF keeps the chosen column count and chord order across complete and partial rows',()=>{
  const entry={notes:[48,52,55,59,64],frets:[null,3,2,0,0,0],tuning:standard,mode:'guitar',preference:'sharp',allowOmit:true,chordKey:'0:maj7:full'};
  const entries=Array.from({length:19},(_,i)=>({...entry,title:`Accord ${i+1}`}));
  for(let columns=1;columns<=6;columns++){
    const pdf=new TextDecoder().decode(createChordPDF(entries,{columns}));
    const rows=[];
    for(const [,page] of pdf.matchAll(/\nstream\n([\s\S]*?)endstream/g)){
      const placements=[...page.matchAll(/^q 1 0 0 1 ([\d.]+) ([\d.]+) cm$/gm)];
      for(const y of new Set(placements.map(([,x,y])=>y))){
        const x=placements.filter(p=>p[2]===y).map(p=>Number(p[1]));
        assert(x.every((value,i)=>i===0||value>x[i-1]));
        rows.push(x.length);
      }
    }
    assert.deepEqual(rows,Array.from({length:Math.ceil(entries.length/columns)},(_,i)=>Math.min(columns,entries.length-i*columns)));
    assert.deepEqual([...pdf.matchAll(/\(Accord (\d+)\) Tj/g)].map(m=>Number(m[1])),entries.map((_,i)=>i+1));
    assert(pdf.includes(columns>=4?'/MediaBox [0 0 841.89 595.28]':'/MediaBox [0 0 595.28 841.89]'));
  }
});
