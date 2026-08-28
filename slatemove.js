/* ===== SLATE MOVE =====
   Casting wants a full body slate for physicality and a closer frame for the read.
   Most home setups do not have the floor space to shoot wide, so coaches teach a
   manual "ken burns" punch-in. This does it as deterministic crop and scale over
   an already-recorded static frame.

   NOTHING IS GENERATED - every output pixel comes from the source frame. But that
   is not the same as nothing being SOFTENED. A crop is fewer pixels, and stretching
   those to the output size is an upscale:

     1080p source, tightest crop -> 806x453 stretched to 1920x1080 = 2.38x. Soft.
     4K    source, tightest crop -> 1612x907 stretched to 1920x1080 = 1.19x. Fine.

   So the move needs resolution to spend. It reports the true cost, refuses when
   the punch-in would go soft, and asks the camera for the largest frame available.

   On FOCUS: cropping cannot change focus. Whatever the lens did during the static
   slate is baked in. If the camera hunted, the move magnifies the hunt. Lock focus
   before you shoot the slate - the app cannot fix it after.

   The HOLD at full body is not decoration. A casting director on full-body slates:
   "no pan-and-scan because it doesn't give us an overall view of your full body."
   The hold is the overall view. Do not shorten it.

   OFF BY DEFAULT. It has to be proven on a real slate before it is trusted. */
(function(g){
const A={};
A.DEFAULTS={
 face:{cx:0.5, cy:0.17, scale:0.42},   // head and shoulders
 body:{cx:0.5, cy:0.50, scale:1.00},   // the whole person
 rest:{cx:0.5, cy:0.34, scale:0.66},   // where it settles for the read
 holdFrom:0.40, holdTo:0.55            // the "one glance at your full self"
};
function smoothstep(t){ t=Math.max(0,Math.min(1,t)); return t*t*(3-2*t); }
A.smoothstep=smoothstep;
function lerp(a,b,t){ return a+(b-a)*t; }

/* u = 0..1 through the move. Returns normalised crop centre and scale. */
A.frameAt=function(u,cfg){
 const c=Object.assign({},A.DEFAULTS,cfg||{});
 const {face,body,rest,holdFrom,holdTo}=c;
 let a,b,t;
 if(u<holdFrom){ a=face; b=body; t=smoothstep(u/holdFrom); }
 else if(u<=holdTo){ return {cx:body.cx, cy:body.cy, scale:body.scale, hold:true}; }
 else { a=body; b=rest; t=smoothstep((u-holdTo)/(1-holdTo)); }
 return {cx:lerp(a.cx,b.cx,t), cy:lerp(a.cy,b.cy,t), scale:lerp(a.scale,b.scale,t), hold:false};
};

/* Convert to source pixels. Returns null if the crop cannot be satisfied without
   upscaling - the whole point is that no pixel is invented. */
/* What the move will actually cost in sharpness. Call this before offering it. */
A.quality=function(W,H,outW,outH,cfg){
 const c=Object.assign({},A.DEFAULTS,cfg||{});
 const tight=Math.min(c.face.scale,c.rest.scale,c.body.scale);
 const cw=W*tight, ch=H*tight;
 const up=Math.max(outW/cw, outH/ch);
 return {tightestCrop:Math.round(cw)+'x'+Math.round(ch),
         upscale:Math.round(up*100)/100,
         native: up<=1.0,
         acceptable: up<=1.35,        // beyond this the punch-in reads soft
         advice: up<=1.0 ? 'Every frame is native resolution or better.'
               : up<=1.35 ? 'Slightly soft at the tightest point. Acceptable.'
               : 'The punch-in would be visibly soft. Shoot the slate at a higher resolution.'};
};
A.cropAt=function(u,W,H,cfg){
 const f=A.frameAt(u,cfg);
 const w=W*f.scale, h=H*f.scale;
 if(w>W+0.5||h>H+0.5) return null;
 let x=f.cx*W-w/2, y=f.cy*H-h/2;
 x=Math.max(0,Math.min(W-w,x));
 y=Math.max(0,Math.min(H-h,y));
 return {x,y,w,h,hold:f.hold,scale:f.scale};
};

/* Render the move to a new video. Draws each frame from the source onto a canvas
   at output size and records the canvas. */
A.render=async function(srcVideo,opts){
 const o=Object.assign({outW:1920,outH:1080,fps:30,seconds:null,cfg:null,onProgress:null},opts||{});
 const W=srcVideo.videoWidth, H=srcVideo.videoHeight;
 if(!W||!H) throw new Error('source has no dimensions');
 const dur=o.seconds||srcVideo.duration;
 if(!isFinite(dur)||dur<=0) throw new Error('source has no duration');
 // refuse before wasting the user's time - on geometry AND on sharpness
 for(let i=0;i<=20;i++){ if(!A.cropAt(i/20,W,H,o.cfg))
   throw new Error('the move would need to enlarge the picture - shoot wider or reduce the scale'); }
 const q=A.quality(W,H,o.outW,o.outH,o.cfg);
 if(!q.acceptable && !o.allowSoft)
   throw new Error('This slate is '+W+'x'+H+'. The tightest frame would be a '+q.upscale
     +'x upscale and read soft. Shoot the slate at a higher resolution, or reduce the punch-in.');

 const cvs=document.createElement('canvas'); cvs.width=o.outW; cvs.height=o.outH;
 const ctx=cvs.getContext('2d');
 const stream=cvs.captureStream(o.fps);
 // carry the original audio through untouched
 try{
  const src=srcVideo.captureStream?srcVideo.captureStream():null;
  if(src) src.getAudioTracks().forEach(t=>stream.addTrack(t));
 }catch(e){}
 let mime='';
 for(const m of ['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm']){
  try{ if(MediaRecorder.isTypeSupported(m)){mime=m;break;} }catch(e){}
 }
 const rec=mime?new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8000000})
               :new MediaRecorder(stream);
 const chunks=[];
 rec.ondataavailable=e=>{ if(e.data.size)chunks.push(e.data); };
 const done=new Promise(res=>{ rec.onstop=()=>res(new Blob(chunks,{type:rec.mimeType||'video/mp4'})); });

 srcVideo.currentTime=0;
 await new Promise(r=>{ const h=()=>{srcVideo.removeEventListener('seeked',h);r();}; srcVideo.addEventListener('seeked',h); });
 rec.start();
 await srcVideo.play().catch(()=>{});
 const t0=performance.now();
 await new Promise(resolve=>{
  const tick=()=>{
   const el=(performance.now()-t0)/1000;
   const u=Math.min(1,el/dur);
   const c=A.cropAt(u,W,H,o.cfg);
   if(c){
    ctx.fillStyle='#000'; ctx.fillRect(0,0,o.outW,o.outH);
    ctx.drawImage(srcVideo, c.x,c.y,c.w,c.h, 0,0,o.outW,o.outH);
   }
   if(o.onProgress)o.onProgress(u);
   if(u>=1){ resolve(); return; }
   requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
 });
 try{ srcVideo.pause(); }catch(e){}
 rec.stop();
 return await done;
};
g.ActorSlateMove=A;
})(window);
