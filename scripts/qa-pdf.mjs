import fs from 'node:fs';
import { createChordPDF } from '../dist/pdf.js';
const tuning=[40,45,50,55,59,64];
const base={tuning,mode:'guitar',title:'Do majeur septième',preference:'sharp',allowOmit:true,chordKey:'0:maj7:full',notes:[48,52,55,59,64],frets:[null,3,2,0,0,0]};
const entries=[base,{...base,title:'Do dièse majeur septième',chordKey:'1:maj7:full',notes:[49,53,56,60,65],frets:[null,4,3,1,1,1]},{...base,title:'Do diminué septième',chordKey:'0:dim7:full',notes:[48,51,54,57],frets:[null,3,1,2,null,2]}, {...base,title:'Six notes sur une très grande plage du clavier',mode:'piano',notes:[24,36,48,60,84,107],frets:Array(6).fill(null),chordKey:null}];
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/qa-export.pdf',createChordPDF(entries));
console.log('artifacts/qa-export.pdf');
