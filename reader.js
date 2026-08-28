/* ===== READER BOOTH =====
   The actor is the machine. You record every line that is not yours - in your own
   voice, at your own pace - and the system strings them together during the take.

   No synthetic voice. A robot reader gives you nothing to play against; your own
   reading carries the rhythm and the intention you actually want to work off.

   Clips live in IndexedDB keyed to the line, so they survive a reload. */
(function(g){
const A={}, DBN='actor_os_reader', STORE='clips';
let _db=null;

function open(){
 if(_db)return Promise.resolve(_db);
 return new Promise((res,rej)=>{
  const r=indexedDB.open(DBN,1);
  r.onupgradeneeded=e=>{const d=e.target.result;
   if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'id'});};
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
A.recording=function(){ return !!rec && rec.state==='recording'; };

/* --- playback during a take --- */
let el=null;
A.play=function(blob,onended){
 A.stopPlay();
 el=new Audio(URL.createObjectURL(blob));
 el.onended=()=>{ try{URL.revokeObjectURL(el.src)}catch(e){}; if(onended)onended(); };
 el.onerror=()=>{ if(onended)onended(); };
 el.play().catch(()=>{ if(onended)onended(); });
 return el;
};
A.stopPlay=function(){ if(el){try{el.pause();URL.revokeObjectURL(el.src)}catch(e){} el=null;} };
A.duration=function(blob){
 return new Promise(res=>{
  const a=new Audio(URL.createObjectURL(blob));
  a.onloadedmetadata=()=>{const d=a.duration;URL.revokeObjectURL(a.src);res(isFinite(d)?d:0)};
  a.onerror=()=>res(0);
 });
};
g.ActorReader=A;
})(window);
