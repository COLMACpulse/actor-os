/* ===== READER BOOTH =====
   The actor is the machine. You record every line that is not yours - in your own
   voice, at your own pace - and the system strings them together during the take.

   No synthetic voice. A robot reader gives you nothing to play against; your own
   reading carries the rhythm and the intention you actually want to work off.

   Clips live in IndexedDB keyed to the line, so they survive a reload. */
(function(g){
const A={}, DBN='actor_os_reader', STORE='clips', TAKES='takes';
let _db=null;

function open(){
 if(_db)return Promise.resolve(_db);
 return new Promise((res,rej)=>{
  const r=indexedDB.open(DBN,2);
  r.onupgradeneeded=e=>{const d=e.target.result;
   if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'id'});
   if(!d.objectStoreNames.contains(TAKES))d.createObjectStore(TAKES,{keyPath:'id'});};
  r.onsuccess=e=>{_db=e.target.result;res(_db)};
  r.onerror=()=>rej(r.error);
 });
}
/* key on the content, so re-uploading the same sides keeps your recordings */
A.keyFor=function(scriptId,who,text){
 let h=0; const s=(who||'')+'|'+(text||'');
 for(let i=0;i<s.length;i++){h=((h<<5)-h+s.charCodeAt(i))|0;}
 return (scriptId||'sides')+':'+(h>>>0).toString(36);
};
A.putTakeFor=async function(lineId,blob,meta){
 const db=await open();
 const id=lineId+'#'+Date.now().toString(36);
 return new Promise((res,rej)=>{
  const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).put(Object.assign({id,line:lineId,blob,at:Date.now()},meta||{}));
  tx.oncomplete=()=>res(id); tx.onerror=()=>rej(tx.error);
 });
};
A.takesFor=async function(lineId){
 const all=await A.all();
 return all.filter(c=>c.line===lineId).sort((a,b)=>a.at-b.at);
};
A.put=async function(id,blob,meta){
 const db=await open();
 return new Promise((res,rej)=>{
  const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).put(Object.assign({id,blob,at:Date.now()},meta||{}));
  tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error);
 });
};
A.get=async function(id){
 const db=await open();
 return new Promise(res=>{
  const q=db.transaction(STORE,'readonly').objectStore(STORE).get(id);
  q.onsuccess=()=>res(q.result||null); q.onerror=()=>res(null);
 });
};
A.del=async function(id){
 const db=await open();
 return new Promise(res=>{
  const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).delete(id); tx.oncomplete=()=>res(true); tx.onerror=()=>res(false);
 });
};
A.all=async function(){
 const db=await open();
 return new Promise(res=>{
  const q=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
  q.onsuccess=()=>res(q.result||[]); q.onerror=()=>res([]);
 });
};

/* --- capture one line --- */
let mic=null, rec=null, chunks=[];
A.armed=function(){return !!mic;};
A.micStream=function(){return mic;};   // the level meter reads the real signal
A.arm=async function(){
 if(mic)return mic;
 mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
 return mic;
};
A.disarm=function(){ if(mic){mic.getTracks().forEach(t=>t.stop());mic=null;} };
A.mime=function(){
 for(const m of ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus']){
  try{ if(MediaRecorder.isTypeSupported(m))return m; }catch(e){}
 }
 return '';
};
A.start=async function(){
 await A.arm(); chunks=[];
 const m=A.mime();
 rec = m ? new MediaRecorder(mic,{mimeType:m}) : new MediaRecorder(mic);
 rec.ondataavailable=e=>{ if(e.data.size)chunks.push(e.data); };
 rec.start();
 return true;
};
A.stop=function(){
 return new Promise(res=>{
  if(!rec||rec.state==='inactive')return res(null);
  rec.onstop=()=>res(new Blob(chunks,{type:rec.mimeType||'audio/webm'}));
  rec.stop();
 });
};

/* ===== LEVEL =====
   Reader lines get recorded across a whole session - close to the phone, far
   from it, loud, muttered. Played back raw they arrive at wildly different
   volumes, which is useless to act against. Measure each clip once at record
   time and store the gain that brings it to a common loudness.

   RMS, not peak: a single consonant spike should not decide the level of a
   whole line. Peak is kept only as a ceiling so boosting never clips. */
const TARGET_RMS=0.08;          // a comfortable spoken level
const MAX_GAIN=8;

A.measure=async function(blob){
 try{
  const AC=g.AudioContext||g.webkitAudioContext; if(!AC) return null;
  const ctx=new AC();
  const buf=await ctx.decodeAudioData(await blob.arrayBuffer());
  let sum=0,n=0,peak=0;
  for(let c=0;c<buf.numberOfChannels;c++){
   const d=buf.getChannelData(c);
   // step through: full precision is pointless for a loudness estimate
   for(let i=0;i<d.length;i+=16){ const v=d[i]; sum+=v*v; n++; if(v>peak)peak=v; else if(-v>peak)peak=-v; }
  }
  try{ ctx.close(); }catch(e){}
  if(!n) return null;
  const rms=Math.sqrt(sum/n);
  if(rms<=0.0005) return {rms:rms,peak:peak,gain:1,silent:true};
  let gain=TARGET_RMS/rms;
  gain=Math.min(gain,MAX_GAIN);
  if(peak>0) gain=Math.min(gain,0.97/peak);    // never drive it into clipping
  return {rms:rms, peak:peak, gain:Math.max(0.2,gain), silent:false};
 }catch(e){ return null; }
};
A.recording=function(){ return !!rec && rec.state==='recording'; };

/* --- playback during a take --- */
let el=null, playCtx=null, playSrc=null, playGain=null;

/* One context for the session. Created lazily so it is born inside a user
   gesture, which is what iOS requires. */
function audioCtx(){
 const AC=g.AudioContext||g.webkitAudioContext; if(!AC) return null;
 if(!playCtx){ try{ playCtx=new AC(); }catch(e){ return null; } }
 if(playCtx.state==='suspended'){ try{ playCtx.resume(); }catch(e){} }
 return playCtx;
}
A.unlockAudio=function(){ return !!audioCtx(); };

/* gain comes from measure(); without it playback is unchanged rather than
   guessed at. */
A.play=function(blob,onended,gain){
 A.stopPlay();
 el=new Audio(URL.createObjectURL(blob));
 el.onended=()=>{ try{URL.revokeObjectURL(el.src)}catch(e){}; if(onended)onended(); };
 el.onerror=()=>{ if(onended)onended(); };
 const gval=(typeof gain==='number'&&isFinite(gain)&&gain>0)?gain:1;
 if(gval!==1){
  const ctx=audioCtx();
  if(ctx){
   try{
    playSrc=ctx.createMediaElementSource(el);
    playGain=ctx.createGain(); playGain.gain.value=gval;
    playSrc.connect(playGain); playGain.connect(ctx.destination);
   }catch(e){ playSrc=playGain=null; el.volume=Math.min(1,gval); }
  } else { el.volume=Math.min(1,gval); }
 }
 el.play().catch(()=>{ if(onended)onended(); });
 return el;
};
A.stopPlay=function(){
 if(el){ try{el.pause();URL.revokeObjectURL(el.src)}catch(e){} el=null; }
 try{ if(playSrc)playSrc.disconnect(); }catch(e){}
 try{ if(playGain)playGain.disconnect(); }catch(e){}
 playSrc=playGain=null;
};
A.duration=function(blob){
 return new Promise(res=>{
  const a=new Audio(URL.createObjectURL(blob));
  a.onloadedmetadata=()=>{const d=a.duration;URL.revokeObjectURL(a.src);res(isFinite(d)?d:0)};
  a.onerror=()=>res(0);
 });
};
/* --- takes: the video itself, so it survives a reload --- */
A.putTake=async function(id,blob){
 const db=await open();
 return new Promise((res,rej)=>{
  const tx=db.transaction(TAKES,'readwrite');
  tx.objectStore(TAKES).put({id,blob,at:Date.now()});
  tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error);
 });
};
A.getTake=async function(id){
 const db=await open();
 return new Promise(res=>{
  const q=db.transaction(TAKES,'readonly').objectStore(TAKES).get(id);
  q.onsuccess=()=>res(q.result?q.result.blob:null); q.onerror=()=>res(null);
 });
};
A.delTake=async function(id){
 const db=await open();
 return new Promise(res=>{
  const tx=db.transaction(TAKES,'readwrite');
  tx.objectStore(TAKES).delete(id); tx.oncomplete=()=>res(true); tx.onerror=()=>res(false);
 });
};
g.ActorReader=A;
})(window);
