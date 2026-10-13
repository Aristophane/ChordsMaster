import { analyze, mod, noteName, frenchName } from './music.js';

// Dependency-free, vector PDF. Built-in Type 1 fonts with explicit WinAnsi encoding.
const colors={ink:'#302f29',muted:'#77776a',accent:'#a94f37',sage:'#718473',paper:'#f5f3ec',line:'#dfdfd4',soft:'#e6ebe1'};
const num=n=>Number(n.toFixed(3));
const rgb=hex=>[1,3,5].map(i=>num(parseInt(hex.slice(i,i+2),16)/255)).join(' ');
export function pdfText(value){
  const simplified=String(value).replace(/♭/g,'b').replace(/♯/g,'#').replace(/[–—−]/g,'-').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/…/g,'...').replace(/↗/g,'');
  const special={'œ':156,'Œ':140,'€':128,'•':149};
  return '('+[...simplified].map(c=>{const n=special[c]??c.charCodeAt(0);return c==='('||c===')'||c==='\\'?'\\'+c:n>255?'?':n<32||n>126?'\\'+n.toString(8).padStart(3,'0'):c;}).join('')+')';
}
function pagePainter(){
  let content='';
  return {
    text(x,y,text,size=10,color=colors.ink,font='F1'){content+=`BT /${font} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${num(x)} ${num(y)} Tm ${pdfText(text)} Tj ET\n`;},
    line(x1,y1,x2,y2,color=colors.line,width=.6){content+=`${rgb(color)} RG ${width} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S\n`;},
    rect(x,y,w,h,fill,stroke=null){if(fill)content+=`${rgb(fill)} rg `;if(stroke)content+=`${rgb(stroke)} RG .5 w `;content+=`${num(x)} ${num(y)} ${num(w)} ${num(h)} re ${fill&&stroke?'B':fill?'f':'S'}\n`;},
    circle(x,y,r,fill){const k=r*.5522848;content+=`${rgb(fill)} rg ${num(x+r)} ${num(y)} m ${num(x+r)} ${num(y+k)} ${num(x+k)} ${num(y+r)} ${num(x)} ${num(y+r)} c ${num(x-k)} ${num(y+r)} ${num(x-r)} ${num(y+k)} ${num(x-r)} ${num(y)} c ${num(x-r)} ${num(y-k)} ${num(x-k)} ${num(y-r)} ${num(x)} ${num(y-r)} c ${num(x+k)} ${num(y-r)} ${num(x+r)} ${num(y-k)} ${num(x+r)} ${num(y)} c f\n`;},
    get content(){return content;}
  };
}
function wrap(text,maxChars){
  const words=String(text).split(/\s+/),lines=[];let line='';
  for(const word of words){if(line.length+word.length+1>maxChars&&line){lines.push(line);line='';}if(word.length>maxChars){if(line){lines.push(line);line='';}for(let i=0;i<word.length;i+=maxChars)lines.push(word.slice(i,i+maxChars));}else line+=(line?' ':'')+word;}
  if(line)lines.push(line);return lines;
}
function guitar(p,entry,chord,x,top){
  const used=entry.frets.filter(f=>f!==null&&f>0),max=used.length?Math.max(...used):4,min=used.length?Math.min(...used):1;
  const start=max<=4?1:min,rows=Math.max(4,max-start+1),w=68,h=77,step=h/rows;
  for(let s=0;s<6;s++)p.line(x+s*w/5,top,x+s*w/5,top-h,'#b4b1a5',.6);
  for(let f=0;f<=rows;f++)p.line(x,top-f*step,x+w,top-f*step,colors.line,f===0&&start===1?2.4:.6);
  if(start>1)p.text(x-13,top-step*.7,String(start),7,colors.muted);
  entry.frets.forEach((f,s)=>{
    const px=x+s*w/5;
    if(f===null)p.text(px-2,top+8,'x',8,colors.muted);
    else if(f===0)p.text(px-2.5,top+8,'o',8,colors.muted);
    else p.circle(px,top-(f-start+.5)*step,Math.min(4,step*.35),chord&&mod(entry.tuning[s]+f)===chord.root?colors.accent:colors.sage);
    p.text(px-2,top-h-12,f===null?'x':String(f),7,colors.muted);
  });
  p.text(x-2,top-h-28,'6',6,colors.muted);p.text(x+w-2,top-h-28,'1',6,colors.muted);
}
function piano(p,entry,chord,x,y,w=346,h=53){
  const start=Math.floor(Math.min(...entry.notes)/12)*12,end=Math.max(start+23,Math.floor(Math.max(...entry.notes)/12)*12+11);
  const white=Array.from({length:end-start+1},(_,i)=>start+i).filter(n=>[0,2,4,5,7,9,11].includes(mod(n)));
  const kw=w/white.length;
  white.forEach((n,i)=>{const selected=entry.notes.includes(n),root=chord&&mod(n)===chord.root;p.rect(x+i*kw,y,kw,h,selected?(root?'#ead0bd':'#d4dfcc'):'#fdfcf8','#b7b7ac');if(selected)p.circle(x+(i+.5)*kw,y+18,2,root?colors.accent:colors.sage);if(mod(n)===0)p.text(x+i*kw+2,y+5,'C'+(Math.floor(n/12)-1),Math.min(6,kw*.35),colors.muted);});
  for(let n=start;n<=end;n++)if([1,3,6,8,10].includes(mod(n))){const index=white.filter(m=>m<n).length,selected=entry.notes.includes(n);p.rect(x+index*kw-kw*.3,y+h*.4,kw*.6,h*.6,selected?(chord&&mod(n)===chord.root?colors.accent:colors.sage):'#373b34');if(selected)p.circle(x+index*kw,y+h*.52,1.7,'#fdfcf8');}
}
function chordCard(p,entry,index,top){
  const analysis=analyze(entry.notes,entry.preference,entry.allowOmit);
  const chord=analysis.candidates.find(c=>c.key===entry.chordKey)||analysis.candidates[0];
  const symbol=chord?.symbol||'Notes libres';
  p.text(43,top+2,String(index+1).padStart(2,'0'),9,colors.accent);
  p.text(68,top,symbol,symbol.length>15?20:28,colors.ink,'F2');
  const nameLines=wrap(entry.title,67).slice(0,2);
  nameLines.forEach((line,i)=>p.text(68,top-19-i*12,line,9,colors.muted));
  const tuning=entry.tuning.map(n=>noteName(n,entry.preference,false,true)).join(' ');
  p.text(68,top-47,(entry.mode==='guitar'?'Guitare':'Piano')+'  ·  Accordage : '+tuning,7.5,colors.muted);
  const hasGuitar=entry.frets.some(f=>f!==null);
  if(hasGuitar)guitar(p,entry,chord,62,top-75);
  else {p.text(50,top-98,'Hauteurs',9,colors.muted);p.text(50,top-113,'hors manche',9,colors.muted);}
  const toneText=chord?chord.tones.filter(t=>t.present).map(t=>`${t.name} (${t.degree})`).join('   '):[...new Set(entry.notes.map(n=>noteName(n,entry.preference)))].join('   ');
  wrap(toneText,74).slice(0,2).forEach((line,i)=>p.text(165,top-76-i*11,line,8,colors.ink));
  piano(p,entry,chord,165,top-148);
  const exact=[...entry.notes].sort((a,b)=>a-b).map(n=>noteName(n,entry.preference,false,true)).join(' · ');
  p.text(165,top-163,exact,7,colors.muted);
  const detail=chord?chord.inversion+(chord.omitted.length?' · Quinte juste omise':''):'Lecture harmonique non déterminée';
  p.text(165,top-177,detail,7.5,colors.muted);
  p.line(43,top-194,552,top-194);
}
export function createChordPDF(entries){
  if(!entries.length)throw Error('Aucun accord sélectionné');
  const pages=[];
  for(let offset=0;offset<entries.length;offset+=3){
    const p=pagePainter();
    p.rect(0,0,595.28,841.89,'#fdfcf8');
    p.rect(43,785,23,3,colors.accent);
    p.text(76,784,'CHORDSMASTER',12,colors.ink);
    p.text(43,752,'Mon carnet d’accords',25,colors.ink,'F2');
    p.text(43,731,entries.length+' accord'+(entries.length>1?'s':'')+' · Notes, positions et intervalles',8,colors.muted);
    p.line(43,715,552,715);
    entries.slice(offset,offset+3).forEach((entry,i)=>chordCard(p,entry,offset+i,681-i*224));
    p.text(43,26,'Tempérament égal · La4 = 440 Hz · Octaves scientifiques (C4 = MIDI 60)',7,colors.muted);
    p.text(523,26,(pages.length+1)+' / '+Math.ceil(entries.length/3),7,colors.muted);
    pages.push(p.content);
  }
  const objects=[null];
  const add=value=>{objects.push(value);return objects.length-1;};
  const catalog=add(''),pageRoot=add('');
  const normal=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const italic=add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>');
  const kids=[];
  for(const content of pages){const stream=add(`<< /Length ${content.length} >>\nstream\n${content}endstream`);kids.push(add(`<< /Type /Page /Parent ${pageRoot} 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${normal} 0 R /F2 ${italic} 0 R >> >> /Contents ${stream} 0 R >>`));}
  objects[catalog]=`<< /Type /Catalog /Pages ${pageRoot} 0 R >>`;
  objects[pageRoot]=`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(n=>n+' 0 R').join(' ')}] >>`;
  let output='%PDF-1.4\n',offsets=[0];
  for(let i=1;i<objects.length;i++){offsets.push(output.length);output+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=output.length;output+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++)output+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  output+=`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(output);
}
