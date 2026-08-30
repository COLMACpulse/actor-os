/* ===== READ-ALONG =====
   Colour the line as it is spoken.

   Given the words of a scripted line and a running transcript of what the mic
   actually heard, decide which script words have been said, which one is being
   said now, and which heard words were NOT in the script.

   Deliberately forgiving. Speech recognition mishears, actors paraphrase, and a
   reader booth take is not a dictation test. A word counts as said if it is a
   near match within a small look-ahead window, so one garbled word does not
   stall the whole line. Anything the recogniser heard that the script does not
   contain is reported separately rather than silently dropped - that is the
   "I added a word" case, and it should be visible, not hidden.

   Pure functions. No DOM, no mic, no timers - so it can be tested directly. */
(function(g){
const A={};

const STOP_PUNCT=/[.,!?;:"'`\u2018\u2019\u201c\u201d()\[\]{}\u2014\u2013-]/g;

A.norm=function(w){
  return String(w||'').toLowerCase().replace(STOP_PUNCT,'').replace(/\s+/g,'').trim();
};

/* Split a line into display tokens, keeping the original text intact so the
   rendered line still reads the way it was written. */
A.tokens=function(text){
  const out=[]; const re=/\S+/g; let m;
  while((m=re.exec(String(text||'')))!==null){
    out.push({raw:m[0], norm:A.norm(m[0]), i:m.index, end:m.index+m[0].length});
  }
  return out;
};

/* Levenshtein, capped - we only care about "close enough". */
function dist(a,b,cap){
  if(a===b) return 0;
  const la=a.length, lb=b.length;
  if(Math.abs(la-lb)>cap) return cap+1;
  if(!la) return lb; if(!lb) return la;
  let prev=new Array(lb+1), cur=new Array(lb+1);
  for(let j=0;j<=lb;j++) prev[j]=j;
  for(let i=1;i<=la;i++){
    cur[0]=i; let best=i;
    for(let j=1;j<=lb;j++){
      const c=a.charCodeAt(i-1)===b.charCodeAt(j-1)?0:1;
      cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+c);
      if(cur[j]<best) best=cur[j];
    }
    if(best>cap) return cap+1;
    const t=prev; prev=cur; cur=t;
  }
  return prev[lb];
}

/* Recognisers pick the wrong member of a homophone pair constantly. Treating
   those as "the actor added a word" would light the line up with false alarms. */
const HOMOPHONES=[
  ['no','know'],['to','too','two'],['there','their','theyre'],['your','youre'],
  ['its','it\u2019s','its'],['hear','here'],['for','four','fore'],['one','won'],
  ['right','write','rite'],['by','buy','bye'],['be','bee'],['weve','weave'],
  ['wear','where','were'],['knew','new'],['past','passed'],['than','then'],
  ['seen','scene'],['piece','peace'],['whos','whose'],['loose','lose']
];
const HOMO={};
HOMOPHONES.forEach(set=>set.forEach(w=>{ HOMO[w]=(HOMO[w]||[]).concat(set.filter(x=>x!==w)); }));

A.close=function(a,b){
  if(!a||!b) return true===false;
  if(a===b) return true;
  if(HOMO[a] && HOMO[a].indexOf(b)>=0) return true;
  // a clipped or swallowed word: "no" for "know", "cause" for "because"
  const sh=a.length<=b.length?a:b, lo=a.length<=b.length?b:a;
  if(sh.length>=2 && lo.length-sh.length<=2 && (lo.startsWith(sh)||lo.endsWith(sh))) return true;
  const n=Math.max(a.length,b.length);
  if(n<=3) return a===b;                       // short words must match exactly
  const cap = n<=5 ? 1 : (n<=8 ? 2 : 3);       // longer words get more slack
  if(a.length>4 && b.length>4){
    // recognisers commonly drop or add a trailing s / d / ing
    const sa=a.replace(/(ing|ed|s)$/,''), sb=b.replace(/(ing|ed|s)$/,'');
    if(sa===sb) return true;
  }
  return dist(a,b,cap)<=cap;
};

/* The core.
   script : the line's text
   heard  : everything the recogniser has produced for this line so far
   opts.lookahead : how far past the cursor a heard word may match (default 3)

   Returns:
     said     - index of the last script word matched, +1 (i.e. how many are done)
     states   - one of 'said' | 'now' | 'todo' per script token
     extras   - heard words that matched nothing in the window
     drift    - extras.length, a cheap "am I off book" signal
     complete - every script word accounted for
*/
A.track=function(script,heard,opts){
  const o=Object.assign({lookahead:3},opts||{});
  const toks=A.tokens(script);
  const hw=String(heard||'').split(/\s+/).map(A.norm).filter(Boolean);
  const states=toks.map(()=>'todo');
  const extras=[];
  let cur=0;

  for(let h=0;h<hw.length;h++){
    const w=hw[h];
    let hit=-1;
    const limit=Math.min(toks.length, cur+o.lookahead+1);
    for(let s=cur;s<limit;s++){
      if(A.close(w,toks[s].norm)){ hit=s; break; }
    }
    if(hit<0){
      // not in the window: either an added word, or a word already spoken
      // (recognisers revise their own output), so only count it as added if it
      // is not one of the last few matched words
      let echo=false;
      for(let s=Math.max(0,cur-3);s<cur;s++){ if(A.close(w,toks[s].norm)){ echo=true; break; } }
      if(!echo) extras.push(w);
      continue;
    }
    // words skipped over count as said - the actor moved on
    for(let s=cur;s<=hit;s++) states[s]='said';
    cur=hit+1;
  }

  if(cur<toks.length) states[cur]='now';
  return {
    tokens:toks, states, extras,
    said:cur, total:toks.length,
    drift:extras.length,
    complete: cur>=toks.length && toks.length>0
  };
};

/* Render to HTML. escape() is passed in so this module owns no escaping policy. */
A.html=function(track,escape){
  const esc=escape||(s=>String(s));
  return track.tokens.map((t,i)=>{
    const cls = track.states[i]==='said' ? 'ra-said'
              : track.states[i]==='now'  ? 'ra-now' : 'ra-todo';
    return '<span class="'+cls+'">'+esc(t.raw)+'</span>';
  }).join(' ');
};

g.ActorReadAlong=A;
})(window);
