/* ===== TRIM + COMPRESS =====
   Replaces the third-party compressor step. Plays the source through a canvas at
   a chosen size and re-records it at a chosen bitrate, trimming as it goes.

   HONEST LIMITS, because they matter:
   - This is a real re-encode, not a container rewrite. It takes as long as the
     clip runs. A 90 second take takes 90 seconds.
   - Quality comes from the bitrate you pick, and the browser's encoder is not as
     good as a dedicated one. It is good enough for a self-tape and it is one step
     instead of another app.
   - Audio is carried through from the source track.
   - Nothing is upscaled. If you ask for a size larger than the source it clamps.

   Actors Access accepts up to 1 GB and asks for under 500 MB. The targets here are
   built around landing well under that without visible damage. */
(function(g){
const A={};

A.PRESETS=[
 {id:'CASTING', label:'Casting standard', h:1080, mbps:8,
  note:'1080p, high bitrate. What most offices expect.'},
 {id:'LIGHT',   label:'Smaller file',     h:1080, mbps:4,
  note:'1080p at half the bitrate. Uploads faster, still clean.'},
 {id:'SMALL',   label:'720p',             h:720,  mbps:2.5,
  note:'When the upload keeps failing or the connection is bad.'}
];
A.estimate=function(seconds,mbps){ return Math.round(seconds*mbps*1000000/8); };

A.mime=function(){
 for(const m of ['video/mp4;codecs=avc1.4d002a,mp4a.40.2','video/mp4;codecs=avc1','video/mp4',
                 'video/webm;codecs=vp9,opus','video/webm']){
  try{ if(MediaRecorder.isTypeSupported(m))return m; }catch(e){}
 }
 return '';
};

/* trimStart / trimEnd in seconds. h = target height. */
A.process=async function(blob,opts){
 const o=Object.assign({h:1080,mbps:8,trimStart:0,trimEnd:0,onProgress:null},opts||{});
 const v=document.createElement('video');
 v.src=URL.createObjectURL(blob); v.muted=false; v.playsInline=true; v.preload='auto';
 await new Promise((res,rej)=>{ v.onloadedmetadata=res; v.onerror=()=>rej(new Error('cannot read that take')); });
 const SW=v.videoWidth, SH=v.videoHeight, dur=v.duration;
 if(!SW||!isFinite(dur)) throw new Error('that take has no usable video');

 const start=Math.max(0,Math.min(o.trimStart,dur-0.2));
 const end=Math.max(start+0.2,Math.min(dur-(o.trimEnd||0),dur));
 const span=end-start;

 // never upscale
 const outH=Math.min(o.h,SH), outW=Math.round(SW*(outH/SH)/2)*2;
 const cvs=document.createElement('canvas'); cvs.width=outW; cvs.height=outH;
 const ctx=cvs.getContext('2d');
 const stream=cvs.captureStream(30);
 try{
  const sv=v.captureStream?v.captureStream():null;
  if(sv) sv.getAudioTracks().forEach(t=>stream.addTrack(t));
 }catch(e){}

 const m=A.mime();
 const rec = m ? new MediaRecorder(stream,{mimeType:m,
                   videoBitsPerSecond:Math.round(o.mbps*1000000), audioBitsPerSecond:128000})
               : new MediaRecorder(stream);
 const chunks=[];
 rec.ondataavailable=e=>{ if(e.data.size)chunks.push(e.data); };
 const done=new Promise(res=>{ rec.onstop=()=>res(new Blob(chunks,{type:rec.mimeType||'video/mp4'})); });

 v.currentTime=start;
 await new Promise(r=>{ const h2=()=>{v.removeEventListener('seeked',h2);r();}; v.addEventListener('seeked',h2); });
 rec.start();
 await v.play().catch(()=>{});
 await new Promise(resolve=>{
  const tick=()=>{
   if(v.currentTime>=end||v.ended){ resolve(); return; }
   ctx.drawImage(v,0,0,outW,outH);
   if(o.onProgress)o.onProgress(Math.min(1,(v.currentTime-start)/span));
   requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
 });
 try{ v.pause(); }catch(e){}
 rec.stop();
 const out=await done;
 URL.revokeObjectURL(v.src);
 return {blob:out, width:outW, height:outH, seconds:Math.round(span*10)/10,
         from:blob.size, to:out.size,
         saved:Math.round((1-out.size/Math.max(1,blob.size))*100)};
};
/* ===== JOIN =====
   Several takes, trimmed, into one continuous file. No off-site editor.

   The hard part is audio. You cannot swap a track in and out of a running
   MediaRecorder, so instead every source video is wired into ONE Web Audio
   destination node and that single track feeds the recorder for the whole
   render. Video is one canvas drawn clip by clip.

   Sources are letterboxed, never stretched, so a mix of orientations joins
   without distorting anyone's face.

   items: [{blob, trimStart, trimEnd, label}] in the order they should play. */
A.join=async function(items,opts){
 const o=Object.assign({h:1080,mbps:8,onProgress:null,gapMs:120},opts||{});
 if(!items||!items.length) throw new Error('nothing to join');
 if(items.length===1) return A.process(items[0].blob,
   {h:o.h,mbps:o.mbps,trimStart:items[0].trimStart,trimEnd:items[0].trimEnd,onProgress:o.onProgress});

 const host=document.createElement('div');
 host.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden';
 document.body.appendChild(host);

 const clips=[];
 try{
  for(const it of items){
   const v=document.createElement('video');
   v.src=URL.createObjectURL(it.blob); v.muted=false; v.playsInline=true;
   v.preload='auto'; v.crossOrigin='anonymous';
   host.appendChild(v);
   await new Promise((res,rej)=>{
     v.onloadedmetadata=res;
     v.onerror=()=>rej(new Error('cannot read '+(it.label||'one of the takes')));
   });
   const dur=v.duration;
   if(!v.videoWidth||!isFinite(dur)) throw new Error((it.label||'a take')+' has no usable video');
   const start=Math.max(0,Math.min(it.trimStart||0,dur-0.2));
   const end=Math.max(start+0.2,Math.min(dur-(it.trimEnd||0),dur));
   clips.push({v,start,end,span:end-start,label:it.label||''});
  }

  // output size: the tallest source, clamped to the preset. Never upscale.
  const srcH=Math.max(...clips.map(c=>c.v.videoHeight));
  const srcW=Math.max(...clips.map(c=>c.v.videoWidth));
  const outH=Math.round(Math.min(o.h,srcH)/2)*2;
  const outW=Math.round(srcW*(outH/srcH)/2)*2;

  const cvs=document.createElement('canvas'); cvs.width=outW; cvs.height=outH;
  const ctx=cvs.getContext('2d');
  ctx.fillStyle='#000'; ctx.fillRect(0,0,outW,outH);

  const stream=cvs.captureStream(30);

  // one audio destination for the whole render, fed by every clip
  let ac=null;
  try{
   const AC=window.AudioContext||window.webkitAudioContext;
   if(AC){
    ac=new AC();
    if(ac.state==='suspended'){ try{ await ac.resume(); }catch(e){} }
    const dest=ac.createMediaStreamDestination();
    for(const c of clips){
     try{ ac.createMediaElementSource(c.v).connect(dest); }catch(e){}
    }
    dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
   }
  }catch(e){ ac=null; }

  const m=A.mime();
  const rec = m ? new MediaRecorder(stream,{mimeType:m,
                    videoBitsPerSecond:Math.round(o.mbps*1000000), audioBitsPerSecond:128000})
                : new MediaRecorder(stream);
  const chunks=[];
  rec.ondataavailable=e=>{ if(e.data.size)chunks.push(e.data); };
  const done=new Promise(res=>{ rec.onstop=()=>res(new Blob(chunks,{type:rec.mimeType||'video/mp4'})); });

  const seek=(v,t)=>new Promise(res=>{
   const h=()=>{ v.removeEventListener('seeked',h); res(); };
   v.addEventListener('seeked',h); v.currentTime=t;
  });

  const draw=v=>{
   const sw=v.videoWidth, sh=v.videoHeight;
   const k=Math.min(outW/sw,outH/sh);          // contain, never crop or stretch
   const w=Math.round(sw*k), h=Math.round(sh*k);
   ctx.fillStyle='#000'; ctx.fillRect(0,0,outW,outH);
   ctx.drawImage(v,Math.round((outW-w)/2),Math.round((outH-h)/2),w,h);
  };

  const total=clips.reduce((s,c)=>s+c.span,0);
  let elapsed=0;

  await seek(clips[0].v,clips[0].start);
  rec.start();

  for(let i=0;i<clips.length;i++){
   const c=clips[i];
   if(i+1<clips.length) seek(clips[i+1].v,clips[i+1].start);  // hide the next seek under this clip
   await c.v.play().catch(()=>{});
   await new Promise(res=>{
    const tick=()=>{
     if(c.v.currentTime>=c.end||c.v.ended){ res(); return; }
     draw(c.v);
     if(o.onProgress)o.onProgress(Math.min(1,(elapsed+(c.v.currentTime-c.start))/total),c.label);
     requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
   });
   try{ c.v.pause(); }catch(e){}
   elapsed+=c.span;
   if(i+1<clips.length && o.gapMs>0){
    // a beat of black between scenes rather than a hard frame collision
    ctx.fillStyle='#000'; ctx.fillRect(0,0,outW,outH);
    await new Promise(r=>setTimeout(r,o.gapMs));
   }
  }

  rec.stop();
  const out=await done;
  try{ if(ac) ac.close(); }catch(e){}
  const from=items.reduce((s,i)=>s+(i.blob.size||0),0);
  return {blob:out, width:outW, height:outH,
          seconds:Math.round(total*10)/10, clips:clips.length,
          from, to:out.size,
          saved:Math.round((1-out.size/Math.max(1,from))*100)};
 } finally {
  clips.forEach(c=>{ try{ URL.revokeObjectURL(c.v.src); }catch(e){} });
  try{ host.remove(); }catch(e){}
 }
};

g.ActorCompress=A;
})(window);
