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
g.ActorCompress=A;
})(window);
