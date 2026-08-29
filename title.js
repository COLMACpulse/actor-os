/* ===== PROJECT TITLE =====
   Where the project name comes from, and how sure we are.

   Three sources, best first. Each one either produces a title with a stated
   provenance or produces nothing. Nothing is UNKNOWN, and UNKNOWN is a real
   answer the operator fills in - it is never quietly replaced by a guess.

   Deliberately NOT a source: the largest text on the page. pdf.js records the
   font resource name at Tf but discards the size operand, and real sides are
   monospace Courier top to bottom anyway, so "biggest text" would be a coin
   flip dressed up as evidence. */
(function(g){
const A={};

/* Words that appear in sides filenames but are never part of a project name. */
const FILE_NOISE=new RegExp('\\b(?:' + [
  'sides?','audition(?:s)?','selftape','self','tape[sd]?','script[s]?','scene[s]?',
  'page[s]?','draft[s]?','rev(?:ised|ision)?','shooting','white','blue','pink',
  'yellow','green','goldenrod','salmon','cherry','buff','tan','cop(?:y|ies)',
  'v\\d+','ver','version','breakdown[s]?','casting','role[s]?','character[s]?',
  'confidential','watermarked','locked','protected','fyi','read(?:ing)?',
  'ep\\d*','e\\d+','s\\d+e\\d+','episode[s]?','pt','part','untitled','final','locked','clean',
  'pdf','doc[x]?','txt','fdx','fountain','md','fd'
].join('|') + ')\\b','gi');

/* Loose numeric debris left over once dates and version tags are gone. */
const NUMERIC_DEBRIS=/(^|\s)\d{1,4}(?=\s|$)/g;

const DATEY=/\b(19|20)\d{2}\b|\b\d{1,2}[-_.]\d{1,2}([-_.]\d{2,4})?\b|\b\d{6,8}\b/g;

/* An explicit label beats everything. "PROJECT: CHAOS IN CREEDE" is not a guess. */
const LABELLED=/^\s*(?:project|production|production title|title|show|series|film|feature|picture|episode title)\s*[:\u2013\u2014-]\s*(.{2,70}?)\s*$/i;

/* Lines that look like a title but are actually something else. */
const NOT_A_TITLE=[
  /^(int|ext|i\/e)[.\s]/i,
  /^(fade|cut|dissolve|smash|match)\s+(in|out|to)\b/i,
  /^(continued|cont'?d|more|omitted)\b/i,
  /^(page|pg|scene|sc)\s*\d/i,
  /^(sides?|audition|self[\s-]?tape|casting|breakdown)\b/i,
  /^(role|character|part)\s*[:\-]/i,
  /^(draft|revision|rev)\b/i,
  /^(written|created|directed|produced)\s+by\b/i,
  /^by\s+/i,
  /^\d/,
  /@|https?:\/\//,
  /^(confidential|do not|property of|copyright|\u00a9)/i,
  /^(a|an|the)?\s*(feature|short|pilot|series|episode)\s*$/i,
];

function tidy(s){
  return String(s||'')
    .replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
    .replace(/[_]+/g,' ').replace(/\s+/g,' ')
    .replace(/^["'\u201c(\[\s]+|["'\u201d)\]\s.,;:-]+$/g,'')
    .trim();
}

function plausible(t){
  if(!t) return false;
  const s=tidy(t);
  if(s.length<2||s.length>70) return false;
  if(!/[A-Za-z]/.test(s)) return false;
  if(s.split(/\s+/).length>10) return false;
  return !NOT_A_TITLE.some(rx=>rx.test(s));
}

function titleCase(s){
  const small=new Set(['a','an','the','and','or','of','in','on','at','to','for','from','by','with','vs']);
  const w=tidy(s).toLowerCase().split(/\s+/);
  return w.map((x,i)=>{
    if(i>0 && small.has(x)) return x;
    return x.charAt(0).toUpperCase()+x.slice(1);
  }).join(' ');
}

/* ---- source 1: an explicit label in the document ---- */
A.fromLabel=function(textOrLines){
  const lines = Array.isArray(textOrLines)
    ? textOrLines.map(l=>typeof l==='string'?l:(l&&l.text)||'')
    : String(textOrLines||'').split('\n');
  for(let i=0;i<Math.min(lines.length,80);i++){
    const m=String(lines[i]||'').match(LABELLED);
    if(m && plausible(m[1])) return {title:tidy(m[1]), source:'LABEL', confidence:'HIGH'};
  }
  return null;
};

/* ---- source 2: the header block above the first slug or cue ---- */
A.fromHeader=function(lines,role,speakers){
  if(!Array.isArray(lines)||!lines.length) return null;
  const spk=new Set((speakers||[]).map(x=>String((x&&x.name)||x||'').toUpperCase()).filter(Boolean));
  if(role) spk.add(String(role).toUpperCase());
  const head=[];
  for(let i=0;i<Math.min(lines.length,60);i++){
    const o=lines[i], t=tidy(typeof o==='string'?o:(o&&o.text)||'');
    if(!t) continue;
    // the scene has started; anything past this point is the scene, not a header
    if(/^(int|ext|i\/e)[.\s]/i.test(t)) break;
    // a character cue means dialogue has begun - stop, and never take the cue
    if(spk.has(t.toUpperCase().replace(/\s*\([^)]*\)\s*/g,'').trim())) break;
    head.push({t, x:(o&&typeof o.x==='number')?o.x:null});
  }
  if(!head.length) return null;
  const cands=head.filter(h=>plausible(h.t) && !spk.has(h.t.toUpperCase()));
  if(!cands.length) return null;
  // an all-caps header line is the convention; prefer it, prefer the first one
  const caps=cands.filter(h=>h.t===h.t.toUpperCase() && /[A-Z]{2}/.test(h.t));
  const pick=(caps[0]||cands[0]);
  return {title:tidy(pick.t), source:'HEADER', confidence:caps.length?'MEDIUM':'LOW'};
};

/* ---- source 3: the filename ---- */
A.fromFilename=function(fname,role,actorName){
  let s=tidy(String(fname||'').replace(/\.[a-z0-9]{2,5}$/i,''));
  if(!s) return null;
  s=s.replace(/[-.]+/g,' ');

  /* Sides filenames overwhelmingly write the actor and role in mixed case and
     the PROJECT IN CAPS: "Bo_Winnick_CHAOS_IN_CREEDE_sides_rev.pdf". Where a run
     of two or more all-caps words exists, that run is the title and whatever
     surrounds it is somebody's name. */
  const parts=s.split(/[\s_]+/).filter(Boolean);
  let best=[], run=[];
  const noise=t=>{ FILE_NOISE.lastIndex=0; const r=FILE_NOISE.test(t); FILE_NOISE.lastIndex=0; return r; };
  for(const t of parts){
    if(/^[A-Z][A-Z'\u2019-]+$/.test(t) && !noise(t)) run.push(t);
    else { if(run.length>best.length) best=run; run=[]; }
  }
  if(run.length>best.length) best=run;
  if(best.length>=2){
    const capsTitle=tidy(best.join(' '));
    if(plausible(capsTitle)) return {title:capsTitle, source:'FILENAME', confidence:'MEDIUM'};
  }
  if(role)      s=s.replace(new RegExp('\\b'+String(role).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi'),' ');
  if(actorName) String(actorName).split(/\s+/).filter(w=>w.length>2)
                  .forEach(w=>{ s=s.replace(new RegExp('\\b'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi'),' '); });
  s=s.replace(DATEY,' ').replace(FILE_NOISE,' ').replace(NUMERIC_DEBRIS,' ')
       .replace(/\s+/g,' ').replace(/^[\s\-\u2013\u2014]+|[\s\-\u2013\u2014]+$/g,'').trim();
  if(!plausible(s)) return null;
  const wasCaps = s===s.toUpperCase() && /[A-Z]{2}/.test(s);
  return {title: wasCaps ? tidy(s) : titleCase(s), source:'FILENAME', confidence:'LOW'};
};

/* ---- the decision ---- */
A.detect=function(o){
  o=o||{};
  const out=[];
  const push=r=>{ if(r&&r.title) out.push(r); };
  // pasted sides have no positioned lines; synthesise them so the header block
  // is readable either way
  const lines = (o.lines&&o.lines.length)
    ? o.lines
    : String(o.text||'').split('\n').map(t=>({text:t}));
  push(A.fromLabel(lines));
  push(A.fromHeader(lines,o.role,o.speakers));
  push(A.fromFilename(o.filename,o.role,o.actorName));
  const seen=new Set(), cands=[];
  for(const c of out){
    const k=c.title.toLowerCase();
    if(seen.has(k)) continue;
    seen.add(k); cands.push(c);
  }
  const best=cands[0]||null;
  return {
    title: best?best.title:'',
    source: best?best.source:'UNKNOWN',
    confidence: best?best.confidence:'NONE',
    candidates: cands
  };
};

A.sourceLabel=function(src){
  return {LABEL:'from the notice header',
          HEADER:'read off the first page',
          FILENAME:'from the filename',
          MANUAL:'you set this',
          UNKNOWN:'not found in the sides'}[src]||'unknown';
};

g.ActorTitle=A;
})(window);
