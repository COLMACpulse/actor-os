/* ===== SIDES =====
   The fuel. Everything else reads from this.
   Handles both common formats:
     CHARACTER            and     CHARACTER: line
     line
*/
(function(g){
const A={};

const STAGE=/^\s*[\(\[].*[\)\]]\s*$/;                    // (beat) / [door slams]
const SLUG=/^\s*(INT|EXT|I\/E)[\.\s]/i;                  // INT. KITCHEN - DAY
const PAGE=/^\s*\d+\s*$|^\s*(CONTINUED|CONT'D|MORE)\s*$/i;
const PAREN=/^\s*\(.*\)\s*$/;
const NAMEC=/^\s*([A-Z][A-Z0-9 .'’\-]{1,32})\s*:\s*(.+)$/;     // BO: line
const NAMEL=/^\s*([A-Z][A-Z0-9 .'’\-]{1,32})(\s*\([^)]*\))?\s*$/; // BO  /  BO (CONT'D)

function cleanName(n){
  return String(n||'').replace(/\s*\([^)]*\)\s*/g,'').replace(/[:\s]+$/,'').trim().toUpperCase();
}

A.parse=function(text){
  const raw=String(text||'').replace(/\r/g,'').split('\n');
  const beats=[]; let cur=null;
  for(let i=0;i<raw.length;i++){
    const ln=raw[i], t=ln.trim();
    if(!t){ cur=null; continue; }
    if(PAGE.test(t)||SLUG.test(t)){ cur=null; continue; }
    if(STAGE.test(t)&&!cur){ beats.push({who:'',text:t.replace(/^[\(\[]|[\)\]]$/g,'').trim(),action:true}); continue; }

    let m=t.match(NAMEC);
    if(m){ beats.push({who:cleanName(m[1]),text:m[2].trim()}); cur=beats[beats.length-1]; continue; }

    // a bare capitalised line followed by dialogue is a speaker cue
    m=t.match(NAMEL);
    if(m && t===t.toUpperCase() && raw[i+1] && raw[i+1].trim() && !NAMEL.test(raw[i+1].trim())){
      const who=cleanName(m[1]);
      let j=i+1, buf=[];
      while(j<raw.length){
        const nx=raw[j].trim();
        if(!nx||NAMEL.test(nx)&&nx===nx.toUpperCase()||SLUG.test(nx))break;
        if(!PAREN.test(nx))buf.push(nx);
        j++;
      }
      if(buf.length){ beats.push({who:who,text:buf.join(' ')}); i=j-1; cur=null; continue; }
    }
    if(PAREN.test(t)) continue;                  // (softly) - direction, not dialogue
    if(cur){ cur.text=(cur.text+' '+t).trim(); }
    else beats.push({who:'',text:t,action:true});
  }
  return beats.filter(b=>b.text);
};

A.speakers=function(beats){
  const c={};
  beats.forEach(b=>{ if(b.who) c[b.who]=(c[b.who]||0)+1; });
  return Object.keys(c).sort((a,b)=>c[b]-c[a]).map(n=>({name:n,lines:c[n]}));
};

/* Pair each of your lines with the cue that precedes it. That pairing is what
   the prompter and the scene partner both run on. */
A.script=function(beats,me){
  const out=[];
  for(let i=0;i<beats.length;i++){
    const b=beats[i];
    if(b.action) continue;
    const mine = b.who===me;
    let cue='';
    for(let j=i-1;j>=0;j--){ if(!beats[j].action && beats[j].who!==me){ cue=beats[j].text; break; } }
    out.push({who:b.who,text:b.text,mine:mine,cue:mine?cue:''});
  }
  return out;
};

A.stats=function(beats,me){
  const mine=beats.filter(b=>b.who===me&&!b.action);
  const words=mine.reduce((n,b)=>n+b.text.split(/\s+/).length,0);
  return {lines:mine.length,words:words,
          estSeconds:Math.round(words/2.6)};   // ~2.6 words/sec spoken
};
g.ActorSides=A;
})(window);
