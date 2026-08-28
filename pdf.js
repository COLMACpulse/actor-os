/* ===== PDF TEXT EXTRACTION =====
   No library. Browsers ship DecompressionStream, which is the only hard part of
   reading a PDF content stream.

   Screenplays are POSITIONAL: a character cue sits at ~3.7in from the left,
   dialogue at ~2.5in, action at ~1.5in. Keeping the x coordinate means the parse
   is more reliable from a PDF than from pasted text, not less.

   Scanned sides are images and contain no text. This says so rather than
   returning an empty result that looks like a parse failure. */
(function(g){
const A={};

async function inflate(bytes){
 for(const fmt of ['deflate','deflate-raw']){
  try{
   const ds=new DecompressionStream(fmt);
   const st=new Blob([bytes]).stream().pipeThrough(ds);
   return new Uint8Array(await new Response(st).arrayBuffer());
  }catch(e){}
 }
 return null;
}
const dec=new TextDecoder('latin1');

/* Build code -> character maps from every /ToUnicode CMap in the file. Modern
   PDFs subset their fonts, so a byte in a string is a glyph index, not a letter.
   Without this the text comes out as gibberish and no name is recognisable. */
function hexToStr(h){
 h=h.replace(/[^0-9a-fA-F]/g,'');
 let s='';
 for(let i=0;i+3<h.length||i+3===h.length;i+=4){
  const v=parseInt(h.substr(i,4),16);
  if(!isNaN(v))s+=String.fromCharCode(v);
 }
 return s;
}
function parseCMap(txt){
 const map={};
 let m;
 const single=/beginbfchar([\s\S]*?)endbfchar/g;
 while((m=single.exec(txt))){
  const pr=/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g; let q;
  while((q=pr.exec(m[1]))) map[parseInt(q[1],16)]=hexToStr(q[2]);
 }
 const range=/beginbfrange([\s\S]*?)endbfrange/g;
 while((m=range.exec(txt))){
  const pr=/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]+)>|\[([\s\S]*?)\])/g; let q;
  while((q=pr.exec(m[1]))){
   const lo=parseInt(q[1],16), hi=parseInt(q[2],16);
   if(q[4]!==undefined){
    const base=parseInt(q[4],16);
    for(let c=lo;c<=hi&&c-lo<65536;c++) map[c]=String.fromCharCode(base+(c-lo));
   } else if(q[5]!==undefined){
    const arr=q[5].match(/<([0-9a-fA-F]+)>/g)||[];
    arr.forEach((a,i)=>{ map[lo+i]=hexToStr(a); });
   }
  }
 }
 return map;
}


function findStreams(buf){
 const s=dec.decode(buf), out=[];
 const re=/(?<![A-Za-z])stream(\r\n|\n|\r)/g; let m;
 while((m=re.exec(s))){
  const start=m.index+m[0].length;
  let end=s.indexOf('endstream',start);
  if(end<0)continue;
  // trim the EOL that precedes endstream
  let e=end; while(e>start && (s[e-1]==='\n'||s[e-1]==='\r')) e--;
  // Filter can be a chain: /Filter [ /ASCII85Decode /FlateDecode ]
  const dict=s.slice(Math.max(0,m.index-500), m.index);
  const fm=dict.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/);
  const filters=fm ? (fm[1].match(/\/(\w+)/g)||[]).map(x=>x.slice(1)) : [];
  out.push({start,end:e,filters});
  re.lastIndex=end;
 }
 return out;
}

/* ASCII85 - reportlab and many real-world PDFs chain this before Flate */
function a85(bytes){
 let s=dec.decode(bytes).replace(/\s+/g,'');
 if(s.startsWith('<~'))s=s.slice(2);
 const t=s.indexOf('~>'); if(t>=0)s=s.slice(0,t);
 const out=[]; let tup=0,n=0;
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(c==='z'&&n===0){ out.push(0,0,0,0); continue; }
  const v=c.charCodeAt(0)-33;
  if(v<0||v>84)continue;
  tup=tup*85+v; n++;
  if(n===5){ out.push((tup>>>24)&255,(tup>>>16)&255,(tup>>>8)&255,tup&255); tup=0;n=0; }
 }
 if(n>0){
  for(let i=n;i<5;i++)tup=tup*85+84;
  const b=[(tup>>>24)&255,(tup>>>16)&255,(tup>>>8)&255,tup&255];
  for(let i=0;i<n-1;i++)out.push(b[i]);
 }
 return new Uint8Array(out);
}

/* pull text-showing operators with their positions.
   Tokenising properly rather than one big alternation - the group indices in a
   combined regex do not line up and Tm silently never fired. */
function readContent(txt){
 const items=[];
 let tx=0,ty=0,lead=14,stack=[],curFont='';
 const TOK=/\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]*>|\[(?:[^\]\\]|\\.)*\]|-?[\d.]+|\/[^\s\/\[\]<>()]+|[A-Za-z*'"]+/g;
 let m;
 while((m=TOK.exec(txt))){
  const t=m[0];
  if(t[0]==='('||t[0]==='['||t[0]==='/'||t[0]==='<'||/^-?[\d.]+$/.test(t)){ stack.push(t); if(stack.length>12)stack.shift(); continue; }
  const n=k=>parseFloat(stack[stack.length-k]);
  switch(t){
   case 'BT': tx=0;ty=0; break;
   case 'Tf': { const f=stack[stack.length-2]; if(f&&f[0]==='/')curFont=f.slice(1); break; }
   case 'Td': ty+=n(1); tx+=n(2); break;
   case 'TD': lead=-n(1); ty+=n(1); tx+=n(2); break;
   case 'Tm': ty=n(1); tx=n(2); break;
   case 'TL': lead=n(1); break;
   case 'T*': ty-=lead; break;
   case 'Tj': case '\'': case '"': {
     const a=stack[stack.length-1]||'';
     let v='';
     if(a[0]==='(') v=unesc(a.slice(1,-1));
     else if(a[0]==='<') v=hexStr(a);
     if(v)items.push({x:tx,y:ty,s:v,font:curFont});
     if(t!=='Tj')ty-=lead;
     break; }
   case 'TJ': {
     const a=stack[stack.length-1]||'';
     if(a[0]==='['){
       let out='';
       const pr=/\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]*>|-?[\d.]+/g; let q;
       while((q=pr.exec(a.slice(1,-1)))){
         const v=q[0];
         if(v[0]==='(') out+=unesc(v.slice(1,-1));
         else if(v[0]==='<') out+=hexStr(v);
         else if(parseFloat(v)<-120) out+=' ';
       }
       if(out)items.push({x:tx,y:ty,s:out,font:curFont});
     }
     break; }
  }
  stack.length=0;
 }
 return items;
}
/* a hex string holds 2-byte glyph codes for composite (Type0) fonts */
function hexStr(tok){
 const h=tok.replace(/[^0-9a-fA-F]/g,'');
 let out='';
 for(let i=0;i+1<h.length;i+=4){
  const v=parseInt(h.substr(i,4),16);
  if(!isNaN(v)) out+=String.fromCharCode(v);
 }
 return out;
}
function unesc(s){
 return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (m,c)=>{
  if(c==='n')return '\n'; if(c==='r')return ''; if(c==='t')return ' ';
  if(c==='('||c===')'||c==='\\')return c;
  if(/^[0-7]+$/.test(c))return String.fromCharCode(parseInt(c,8));
  return '';
 });
}

/* group runs into visual lines, then use the left margin to label each one */
function toLines(items){
 const rows=new Map();
 items.forEach(it=>{
  const key=Math.round(it.y/2)*2;                 // tolerate sub-point drift
  if(!rows.has(key))rows.set(key,[]);
  rows.get(key).push(it);
 });
 return [...rows.entries()]
  .sort((a,b)=>a[0]-b[0])                          // observed order in real sides
  .map(([y,arr])=>{
    arr.sort((a,b)=>a.x-b.x);
    let s='',prev=null;
    arr.forEach(it=>{
      if(prev!==null && it.x-prev>6) s+=' ';
      s+=it.s; prev=it.x+it.s.length*6;
    });
    return {y, x:arr[0].x, text:s.replace(/\s+/g,' ').trim()};
  })
  .filter(r=>r.text);
}

A.extract=async function(arrayBuffer){
 const buf=new Uint8Array(arrayBuffer);
 const head=dec.decode(buf.slice(0,Math.min(buf.length,4096)));
 const all=dec.decode(buf);
 // Studio sides are frequently permission-protected. The streams are encrypted,
 // so anything we pull out is noise. Detect it rather than returning garbage.
 const encrypted=/\/Encrypt\s+\d+\s+\d+\s+R|\/Encrypt\s*<</.test(all);
 const version=(head.match(/%PDF-(\d\.\d)/)||[])[1]||'?';
 const streams=findStreams(buf);
 let pages=[], cmap={}, sawCMap=false;
 for(const st of streams){
  let data=buf.slice(st.start,st.end);
  let bad=false;
  for(const f of st.filters){
   if(f==='ASCII85Decode'){ data=a85(data); }
   else if(f==='FlateDecode'){ const inf=await inflate(data); if(!inf){bad=true;break;} data=inf; }
   else if(f==='ASCIIHexDecode'){
    const hx=dec.decode(data).replace(/[^0-9a-fA-F]/g,'');
    const o=new Uint8Array(hx.length>>1);
    for(let i=0;i<o.length;i++)o[i]=parseInt(hx.substr(i*2,2),16);
    data=o;
   }
   else { bad=true; break; }          // DCT, JPX etc - an image, not text
  }
  if(bad)continue;
  const txt=dec.decode(data);
  if(/beginbfchar|beginbfrange/.test(txt)){ Object.assign(cmap,parseCMap(txt)); sawCMap=true; continue; }
  // objects compressed inside an /ObjStm - unpack and look again
  if(/\/ObjStm/.test(dec.decode(buf.slice(Math.max(0,st.start-500),st.start)))){
   if(/beginbfchar|beginbfrange/.test(txt)){ Object.assign(cmap,parseCMap(txt)); sawCMap=true; }
   continue;
  }
  if(!/\bTj\b|\bTJ\b/.test(txt))continue;
  const got=readContent(txt);
  if(got.length)pages.push(got);
 }
 // if the raw text is mostly unprintable, the strings are glyph codes - remap
 const rawAll=pages.flat().map(i=>i.s).join('');
 const printable=(rawAll.match(/[\x20-\x7e]/g)||[]).length/Math.max(1,rawAll.length);
 if(sawCMap && printable<0.72){
  pages=pages.map(pg=>pg.map(i=>({x:i.x,y:i.y,s:[...i.s].map(ch=>{
    const c=ch.charCodeAt(0);
    return (cmap[c]!==undefined)?cmap[c]:ch; }).join('')})));
 }
 const lines=pages.reduce((acc,pg)=>acc.concat(toLines(pg)),[]);
 const allTxt=lines.map(l=>l.text).join('');
 const pr=(allTxt.match(/[\x20-\x7e]/g)||[]).length/Math.max(1,allTxt.length);
 return {lines, chars:allTxt.length, printable:Math.round(pr*100)/100,
         cmapEntries:Object.keys(cmap).length, streams:streams.length,
         encrypted:encrypted, version:version,
         images:(all.match(/\/Subtype\s*\/Image/g)||[]).length};
};

/* Turn positioned lines into the same shape the text parser produces.
   Character cue vs dialogue is decided by indent, not by guessing at case. */
/* Real sides from Breakdown Services / Actors Access carry a lot that is not the
   scene: a diagonal watermark, production headers, scene numbers in both margins,
   page footers, and an instructions page. All of it has to go before the parse. */
const JUNK=[
 /^Sides by Breakdown Services/i,
 /^\(?CONTINUED\)?:?$/i,
 /^\d+\s*\/\s*\d+$/,                       // 1/4 page counter
 /^\d+\s+CONTINUED:?(\s*\(\d+\))?\s+\d+$/i,// 5 CONTINUED: (2) 5
 /^\d{1,3}\s+\d{1,3}$/,                    // scene number in both margins
 /^\d{1,3}\.?$/,                           // bare page or scene number
 /Studio\/Network Draft/i,
 /^Role:\s*/i,
 /^FYI\s*$/i,
];
function isWatermark(l){
 const t=l.text;
 if(l.x<0||l.x>620) return true;                 // rotated / off-page
 if(/^(E\d{3}-){3,}/.test(t)) return true;       // E382-E382-E382...
 if(/(\d{1,2}:\d{2}\s*(AM|PM)\s*-\s*\d+\s*-\s*){2,}/i.test(t)) return true;
 if(/(\w+\s+\d{1,2},\s*\d{4}\s+\d{1,2}:\d{2}\s*(AM|PM)[^a-z]*){2,}/i.test(t)) return true;
 return false;
}
A.clean=function(lines){
 return lines.filter(l=>{
  const t=(l.text||'').trim();
  if(!t) return false;
  if(isWatermark(l)) return false;
  if(JUNK.some(rx=>rx.test(t))) return false;
  return true;
 });
};
/* The header names the part on every page - that is who the actor is. */
A.roleFrom=function(lines){
 for(const l of lines){
  const m=(l.text||'').match(/^Role:\s*(.+?)\s*$/i);
  if(m) return m[1].trim().toUpperCase();
 }
 return '';
};
/* Instructions pages have no character cues. Drop any leading run without one. */
A.trimToScene=function(lines){
 const first=lines.findIndex(l=>l.x>=240&&l.x<=340&&/^[A-Z][A-Z0-9 .'\u2019\-()]{1,32}$/.test(l.text.trim()));
 return first>0?lines.slice(first):lines;
};

/* Look for typed START / END markers. Returns indices into the cleaned lines,
   or -1. Handwritten markers are ink on the page and cannot be found this way. */
A.findMarkers=function(lines){
 let start=-1,end=-1;
 lines.forEach((l,i)=>{
  const t=(l.text||'').trim();
  if(start<0 && /(^|\s)(START|BEGIN)\s*[\u2192\u2794>\-]*\s*$|^[\u2192\u2794>]+\s*START/i.test(t)) start=i;
  if(/^[\u2190<\-]*\s*(END|STOP)(\s|$)|(^|\s)(END|STOP)\s*$/i.test(t)) end=i;
 });
 return {start,end};
};
A.toSides=function(lines){
 lines=A.trimToScene(A.clean(lines));
 if(!lines.length)return '';
 const xs=lines.map(l=>l.x).sort((a,b)=>a-b);
 const actionX=xs[0];
 const capIndents=lines.filter(l=>l.text===l.text.toUpperCase()&&l.text.length<34&&/[A-Z]{2}/.test(l.text)).map(l=>l.x);
 const cueX = capIndents.length ? capIndents.sort((a,b)=>b-a)[Math.floor(capIndents.length*0.25)] : actionX+150;
 const out=[];
 lines.forEach(l=>{
  const txt=l.text.replace(/\u2019/g,"'").replace(/\u2018/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u00d5/g,"'");
  const isCue = l.x>=cueX-16 && txt===txt.toUpperCase() && txt.length<34 && /[A-Z]{2}/.test(txt)
                && !/^(INT|EXT|I\/E)[\.\s]/.test(txt);
  const isAction = !isCue && l.x<=actionX+12;
  if(isCue) out.push('', txt.replace(/\s*\(CONT'?D\)\s*/i,'').trim(), null);
  else if(isAction) out.push('', txt, '');
  else out.push(txt);
 });
 return out.filter(x=>x!==null).join('\n').replace(/\n{3,}/g,'\n\n').trim();
};
g.ActorPDF=A;
})(window);
