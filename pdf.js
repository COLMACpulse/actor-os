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

function findStreams(buf){
 const s=dec.decode(buf), out=[];
 const re=/stream(\r\n|\n|\r)/g; let m;
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
 let tx=0,ty=0,lead=14,stack=[];
 const TOK=/\((?:\\.|[^\\()])*\)|\[(?:[^\]\\]|\\.)*\]|-?[\d.]+|\/[^\s\/\[\]<>()]+|[A-Za-z*'"]+/g;
 let m;
 while((m=TOK.exec(txt))){
  const t=m[0];
  if(t[0]==='('||t[0]==='['||t[0]==='/'||/^-?[\d.]+$/.test(t)){ stack.push(t); if(stack.length>12)stack.shift(); continue; }
  const n=k=>parseFloat(stack[stack.length-k]);
  switch(t){
   case 'BT': tx=0;ty=0; break;
   case 'Td': ty+=n(1); tx+=n(2); break;
   case 'TD': lead=-n(1); ty+=n(1); tx+=n(2); break;
   case 'Tm': ty=n(1); tx=n(2); break;
   case 'TL': lead=n(1); break;
   case 'T*': ty-=lead; break;
   case 'Tj': case '\'': case '"': {
     const a=stack[stack.length-1]||'';
     if(a[0]==='('){ const v=unesc(a.slice(1,-1)); if(v)items.push({x:tx,y:ty,s:v}); }
     if(t!=='Tj')ty-=lead;
     break; }
   case 'TJ': {
     const a=stack[stack.length-1]||'';
     if(a[0]==='['){
       let out='';
       const pr=/\((?:\\.|[^\\()])*\)|-?[\d.]+/g; let q;
       while((q=pr.exec(a.slice(1,-1)))){
         const v=q[0];
         if(v[0]==='(') out+=unesc(v.slice(1,-1));
         else if(parseFloat(v)<-120) out+=' ';
       }
       if(out)items.push({x:tx,y:ty,s:out});
     }
     break; }
  }
  stack.length=0;
 }
 return items;
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
  .sort((a,b)=>b[0]-a[0])                          // PDF y grows upward
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
 const streams=findStreams(buf);
 let items=[];
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
  if(!/\bTj\b|\bTJ\b/.test(txt))continue;
  items=items.concat(readContent(txt));
 }
 const lines=toLines(items);
 return {lines, chars:lines.reduce((n,l)=>n+l.text.length,0)};
};

/* Turn positioned lines into the same shape the text parser produces.
   Character cue vs dialogue is decided by indent, not by guessing at case. */
A.toSides=function(lines){
 if(!lines.length)return '';
 const xs=lines.map(l=>l.x).sort((a,b)=>a-b);
 const actionX=xs[0];                                  // leftmost = action / slug
 const capIndents=lines.filter(l=>l.text===l.text.toUpperCase()&&l.text.length<34&&/[A-Z]{2}/.test(l.text)).map(l=>l.x);
 const cueX = capIndents.length ? capIndents.sort((a,b)=>b-a)[Math.floor(capIndents.length*0.25)] : actionX+150;
 const out=[];
 lines.forEach(l=>{
  const isCue = l.x>=cueX-14 && l.text===l.text.toUpperCase() && l.text.length<34 && /[A-Z]{2}/.test(l.text);
  // action sits at the left margin. Without a blank line before it the text
  // parser folds it into the previous character's dialogue.
  const isAction = !isCue && l.x<=actionX+10;
  if(isCue) out.push('', l.text.replace(/\s*\(CONT'?D\)\s*/i,'').trim(), null);
  else if(isAction) out.push('', l.text, '');
  else out.push(l.text);
 });
 return out.filter(x=>x!==null).join('\n').replace(/\n{3,}/g,'\n\n').trim();
};
g.ActorPDF=A;
})(window);
