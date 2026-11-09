import { analyze, mod, noteName, chordLabel } from './music.js';

// Dependency-free, vector PDF. Built-in Type 1 fonts with explicit WinAnsi encoding.
const colors={ink:'#302f29',muted:'#77776a',accent:'#a94f37',sage:'#718473',paper:'#f5f3ec',line:'#dfdfd4',soft:'#e6ebe1'};
const num=n=>Number(n.toFixed(3));
const rgb=hex=>[1,3,5].map(i=>num(parseInt(hex.slice(i,i+2),16)/255)).join(' ');
const special={'œ':156,'Œ':140,'€':128,'•':149};
// Standard PDF font advances for WinAnsi codes 32 through 255, in 1/1000 em.
const advances={
  F1:[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
  F2:[250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541,350,500,350,333,500,556,889,500,500,333,1000,500,333,944,350,556,350,350,333,333,556,556,350,500,889,333,980,389,333,667,350,389,556,250,389,500,500,500,500,275,500,333,760,276,500,675,333,760,333,400,675,300,300,333,500,523,250,333,300,310,500,750,750,750,500,611,611,611,611,611,611,889,667,611,611,611,611,333,333,333,333,722,667,722,722,722,722,722,675,722,722,722,722,722,556,611,500,500,500,500,500,500,500,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,675,500,500,500,500,500,444,500,444]
};
const plain=value=>String(value).replace(/♭/g,'b').replace(/♯/g,'#').replace(/[–—−]/g,'-').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/…/g,'...').replace(/↗/g,'');
const winAnsi=c=>{const code=special[c]??c.charCodeAt(0);return code>255?63:code<32?32:code;};
const textWidth=(value,size,font='F1')=>[...plain(value)].reduce((width,c)=>width+advances[font][winAnsi(c)-32],0)*size/1000;
export function pdfText(value){
  return '('+[...plain(value)].map(c=>{const n=winAnsi(c);return c==='('||c===')'||c==='\\'?'\\'+c:n>126?'\\'+n.toString(8).padStart(3,'0'):String.fromCharCode(n);}).join('')+')';
}
function pagePainter(){
  let content='';
  return {
    text(x,y,text,size=10,color=colors.ink,font='F1'){content+=`BT /${font} ${num(size)} Tf ${rgb(color)} rg 1 0 0 1 ${num(x)} ${num(y)} Tm ${pdfText(text)} Tj ET\n`;},
    centered(x,y,text,size,color){this.text(x-textWidth(text,size)/2,y,text,size,color);},
    line(x1,y1,x2,y2,color=colors.line,width=.6){content+=`${rgb(color)} RG ${width} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S\n`;},
    rect(x,y,w,h,fill,stroke=null){if(fill)content+=`${rgb(fill)} rg `;if(stroke)content+=`${rgb(stroke)} RG .35 w `;content+=`${num(x)} ${num(y)} ${num(w)} ${num(h)} re ${fill&&stroke?'B':fill?'f':'S'}\n`;},
    circle(x,y,r,color,open=false){const k=r*.5522848;content+=`${rgb(color)} ${open?'RG 1 w':'rg'} ${num(x+r)} ${num(y)} m ${num(x+r)} ${num(y+k)} ${num(x+k)} ${num(y+r)} ${num(x)} ${num(y+r)} c ${num(x-k)} ${num(y+r)} ${num(x-r)} ${num(y+k)} ${num(x-r)} ${num(y)} c ${num(x-r)} ${num(y-k)} ${num(x-k)} ${num(y-r)} ${num(x)} ${num(y-r)} c ${num(x+k)} ${num(y-r)} ${num(x+r)} ${num(y-k)} ${num(x+r)} ${num(y)} c ${open?'S':'f'}\n`;},
    place(x,y,drawing){content+=`q 1 0 0 1 ${num(x)} ${num(y)} cm\n${drawing}Q\n`;},
    get content(){return content;}
  };
}
function wrap(text,width,size){
  const lines=[];let line='';
  for(const word of String(text).trim().split(/\s+/)){
    const next=line?line+' '+word:word;
    if(textWidth(next,size)<=width){line=next;continue;}
    if(line){lines.push(line);line='';}
    for(const char of word){if(line&&textWidth(line+char,size)>width){lines.push(line);line='';}line+=char;}
  }
  if(line)lines.push(line);return lines;
}
function guitar(p,entry,chord,x,top,width){
  const used=entry.frets.filter(f=>f!==null&&f>0),max=used.length?Math.max(...used):4,min=used.length?Math.min(...used):1;
  const start=max<=4?1:Math.min(min,21),count=Math.max(4,max-start+1),end=start+count-1;
  const gap=Math.min(10.5,Math.max(7.4,width/18)),left=x+25,y=top-14,w=width-41,h=gap*5,step=w/count;
  for(let row=0;row<6;row++)p.line(left,y-row*gap,left+w,y-row*gap,'#818174',.65);
  for(let f=0;f<=count;f++){
    const nut=f===0&&start===1;
    p.line(left+f*step,y,left+f*step,y-h,nut?colors.ink:'#a8a798',nut?1.8:.55);
  }
  // Preserve legibility for wide stretches: prefer the boundaries and played frets.
  const labels=step>=10?Array.from({length:count},(_,i)=>start+i):[...new Set([start,end,...used])];
  const placed=[];
  for(const fret of labels){
    const mid=left+(fret-start+.5)*step,label=String(fret),half=textWidth(label,6.4)/2;
    if(placed.some(([a,b])=>mid-half<b+2&&mid+half>a-2))continue;
    placed.push([mid-half,mid+half]);p.centered(mid,top-7,label,6.4,colors.muted);
  }
  for(let s=5;s>=0;s--){
    const fret=entry.frets[s],row=y-(5-s)*gap,root=fret!==null&&chord&&mod(entry.tuning[s]+fret)===chord.root;
    const color=root?colors.accent:colors.sage;
    p.text(x,row-2,noteName(entry.tuning[s],entry.preference),6.4,colors.muted);
    if(fret===null)p.centered(left-8,row-2,'×',7,colors.ink);
    else if(fret===0)p.circle(left-8,row,2.1,color,true);
    else p.circle(left+(fret-start+.5)*step,row,Math.min(3.5,gap*.36,step*.4),color);
    p.centered(left+w+9,row-2,fret===null?'×':String(fret),6.7,colors.ink);
  }
  return 14+h+8;
}
function piano(p,entry,chord,x,y,w,h){
  const start=Math.floor(Math.min(...entry.notes)/12)*12,end=Math.max(start+23,Math.floor(Math.max(...entry.notes)/12)*12+11);
  const white=Array.from({length:end-start+1},(_,i)=>start+i).filter(n=>[0,2,4,5,7,9,11].includes(mod(n)));
  const kw=w/white.length;
  white.forEach((n,i)=>{const selected=entry.notes.includes(n),root=chord&&mod(n)===chord.root;p.rect(x+i*kw,y,kw,h,selected?(root?'#ead0bd':'#d4dfcc'):'#fdfcf8','#b7b7ac');if(selected)p.circle(x+(i+.5)*kw,y+h*.33,Math.min(1.9,kw*.29),root?colors.accent:colors.sage);if(mod(n)===0&&kw>=9.5)p.text(x+i*kw+1,y+2,'C'+(Math.floor(n/12)-1),5.5,colors.muted);});
  for(let n=start;n<=end;n++)if([1,3,6,8,10].includes(mod(n))){const index=white.filter(m=>m<n).length,selected=entry.notes.includes(n);p.rect(x+index*kw-kw*.3,y+h*.4,kw*.6,h*.6,selected?(chord&&mod(n)===chord.root?colors.accent:colors.sage):'#373b34');if(selected)p.circle(x+index*kw,y+h*.53,Math.min(1.45,kw*.21),'#fdfcf8');}
}
function chordCard(entry,index,width){
  const analysis=analyze(entry.notes,entry.preference,entry.allowOmit);
  const chord=analysis.candidates.find(c=>c.key===entry.chordKey)||analysis.candidates[0];
  const symbol=chord?chordLabel(chord,entry.preference):'Notes libres';
  const hasGuitar=entry.frets.some(f=>f!==null);
  const p=pagePainter(),symbolSize=Math.min(width>=200?23:18,(width-24)/textWidth(symbol,1,'F2'));
  p.text(0,-symbolSize+1,String(index+1).padStart(2,'0'),7.5,colors.accent);
  p.text(22,-symbolSize,symbol,symbolSize,colors.ink,'F2');
  let top=-symbolSize-5;
  const block=(text,size,leading,color=colors.muted)=>{
    for(const line of wrap(text,width-1,size)){p.text(0,top-size,line,size,color);top-=leading;}
  };
  block(entry.title,8,10);
  const tuning=entry.tuning.map(n=>noteName(n,entry.preference,false,true)).join(' ');
  block((entry.mode==='guitar'?'Guitare':'Piano')+(hasGuitar?' · '+tuning:' · Hauteurs hors manche'),7.2,10);
  top-=5;
  const alongside=hasGuitar&&width>=360,neckWidth=alongside?Math.min(240,width*.46):width;
  const keysWidth=alongside?width-neckWidth-16:Math.min(width,300),keysHeight=Math.min(40,Math.max(25,keysWidth*.16));
  if(alongside){
    const neckHeight=guitar(p,entry,chord,0,top,neckWidth);
    piano(p,entry,chord,neckWidth+16,top-14-keysHeight,keysWidth,keysHeight);
    top-=Math.max(neckHeight,14+keysHeight)+6;
  }else{
    if(hasGuitar)top-=guitar(p,entry,chord,0,top,neckWidth);
    piano(p,entry,chord,0,top-keysHeight,keysWidth,keysHeight);
    top-=keysHeight+7;
  }
  const toneText=chord?chord.tones.filter(t=>t.present).map(t=>`${noteName(t.pc,entry.preference)} (${t.degree})`).join('   '):[...new Set(entry.notes.map(n=>noteName(n,entry.preference)))].join('   ');
  block(toneText,7.5,10,colors.ink);
  const exact=[...entry.notes].sort((a,b)=>a-b).map(n=>noteName(n,entry.preference,false,true)).join(' · ');
  block(exact,7.2,10);
  const detail=chord?chord.inversion+(chord.omitted.length?' · Quinte juste omise':''):'Lecture harmonique non déterminée';
  block(detail,7.2,9.5);
  return {content:p.content,height:-top};
}
export function createChordPDF(entries,{columns=1}={}){
  if(!entries.length)throw Error('Aucun accord sélectionné');
  columns=Number.isInteger(columns)?Math.max(1,Math.min(6,columns)):1;
  const [width,height]=columns>=4?[841.89,595.28]:[595.28,841.89];
  const margin=36,columnGap=12,rowGap=16,firstTop=height-108,bottom=48;
  const cardWidth=(width-2*margin-(columns-1)*columnGap)/columns;
  const groups=[];let rows=[],remaining=firstTop-bottom;
  for(let offset=0;offset<entries.length;offset+=columns){
    const cards=entries.slice(offset,offset+columns).map((entry,i)=>chordCard(entry,offset+i,cardWidth));
    const rowHeight=Math.max(...cards.map(card=>card.height));
    if(rows.length&&rowHeight+rowGap>remaining){groups.push(rows);rows=[];remaining=firstTop-bottom;}
    remaining-=rowHeight+(rows.length?rowGap:0);
    rows.push({cards,height:rowHeight});
  }
  if(rows.length)groups.push(rows);
  const pages=groups.map((group,pageIndex)=>{
    const p=pagePainter();
    p.rect(0,0,width,height,'#fdfcf8');
    p.rect(margin,height-42,20,2.5,colors.accent);
    p.text(margin+29,height-44,'CHORDSMASTER',10,colors.ink);
    p.text(margin,height-70,'Mon carnet d’accords',24,colors.ink,'F2');
    p.text(margin,height-85,`${entries.length} accord${entries.length>1?'s':''} · ${columns} par ligne`,8,colors.muted);
    p.line(margin,height-96,width-margin,height-96);
    let top=firstTop;
    group.forEach((row,i)=>{
      row.cards.forEach((card,col)=>{
        const x=margin+col*(cardWidth+columnGap);
        if(col)p.line(x-columnGap/2,top,x-columnGap/2,top-row.height,colors.line,.45);
        p.place(x,top,card.content);
      });
      top-=row.height;
      if(i<group.length-1)p.line(margin,top-rowGap/2,width-margin,top-rowGap/2);
      top-=rowGap;
    });
    p.line(margin,38,width-margin,38);
    p.text(margin,24,'Tempérament égal · La4 = 440 Hz · C4 = MIDI 60',7,colors.muted);
    const pageNumber=(pageIndex+1)+' / '+groups.length;
    p.text(width-margin-textWidth(pageNumber,7),24,pageNumber,7,colors.muted);
    return p.content;
  });
  const objects=[null];
  const add=value=>{objects.push(value);return objects.length-1;};
  const catalog=add(''),pageRoot=add('');
  const normal=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const italic=add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>');
  const kids=[];
  for(const content of pages){const stream=add(`<< /Length ${content.length} >>\nstream\n${content}endstream`);kids.push(add(`<< /Type /Page /Parent ${pageRoot} 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${normal} 0 R /F2 ${italic} 0 R >> >> /Contents ${stream} 0 R >>`));}
  objects[catalog]=`<< /Type /Catalog /Pages ${pageRoot} 0 R >>`;
  objects[pageRoot]=`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(n=>n+' 0 R').join(' ')}] >>`;
  let output='%PDF-1.4\n',offsets=[0];
  for(let i=1;i<objects.length;i++){offsets.push(output.length);output+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=output.length;output+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++)output+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  output+=`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(output);
}
