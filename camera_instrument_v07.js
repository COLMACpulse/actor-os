
/* ACTOR OS v0.7 CAMERA INSTRUMENT
   Technical coaching only. Never scores acting quality.
*/
(function(global){
'use strict';
const Cam = {
 stream:null, analyser:null, audioCtx:null, raf:null, facing:'user',
 coachEnabled:true, targetMode:'PARTNER_MARK', prompterMode:'OFF',
 canvas:null, ctx:null, video:null, last:{},
 async permissions(){
   if(!navigator.mediaDevices?.getUserMedia) throw new Error('Camera/microphone API unavailable. Use the installed app or HTTPS.');
   // A single explicit user action requests both permissions.
   const s=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
   s.getTracks().forEach(t=>t.stop());
   return true;
 },
 async start(opts={}){
   this.stop();
   this.facing=opts.facing||this.facing;
   this.video=opts.video||document.querySelector('#cameraPreview');
   this.canvas=opts.canvas||document.querySelector('#meterCanvas');
   this.ctx=this.canvas?.getContext('2d',{willReadFrequently:true})||null;
   const constraints={
     video:{
       facingMode:{ideal:this.facing},
       width:{ideal:1920}, height:{ideal:1080}, frameRate:{ideal:30}
     },
     audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}
   };
   this.stream=await navigator.mediaDevices.getUserMedia(constraints);
   if(this.video){this.video.srcObject=this.stream; await this.video.play().catch(()=>{});}
   this._startAudio();
   this._loop();
   return this.deviceSummary();
 },
 stop(){
   if(this.raf) cancelAnimationFrame(this.raf);
   this.raf=null;
   if(this.stream) this.stream.getTracks().forEach(t=>t.stop());
   this.stream=null;
   if(this.audioCtx) this.audioCtx.close().catch(()=>{});
   this.audioCtx=null; this.analyser=null;
 },
 async switchCamera(){
   this.facing=this.facing==='user'?'environment':'user';
   return this.start({facing:this.facing,video:this.video,canvas:this.canvas});
 },
 setCoach(on){this.coachEnabled=!!on;},
 setTargetMode(mode){this.targetMode=mode;},
 _startAudio(){
   if(!this.stream) return;
   const AC=global.AudioContext||global.webkitAudioContext;
   if(!AC) return;
   this.audioCtx=new AC();
   const src=this.audioCtx.createMediaStreamSource(this.stream);
   this.analyser=this.audioCtx.createAnalyser();
   this.analyser.fftSize=2048;
   src.connect(this.analyser);
 },
 audioStats(){
   if(!this.analyser) return {rms:null,peak:null,clip:false};
   const a=new Float32Array(this.analyser.fftSize); this.analyser.getFloatTimeDomainData(a);
   let sq=0,peak=0; for(const v of a){sq+=v*v;peak=Math.max(peak,Math.abs(v))}
   return {rms:Math.sqrt(sq/a.length),peak,clip:peak>=.985};
 },
 frameStats(){
   const v=this.video,c=this.canvas,x=this.ctx;
   if(!v||!c||!x||!v.videoWidth) return null;
   const W=160,H=Math.max(90,Math.round(160*v.videoHeight/v.videoWidth));
   c.width=W;c.height=H;x.drawImage(v,0,0,W,H);
   const d=x.getImageData(0,0,W,H).data;
   let sum=0, dark=0, bright=0, mid=0;
   for(let i=0;i<d.length;i+=4){
     const y=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
     sum+=y;if(y<35)dark++;if(y>235)bright++;if(y>=60&&y<=210)mid++;
   }
   const n=d.length/4;
   return {meanLuma:sum/n,darkFraction:dark/n,highlightFraction:bright/n,midFraction:mid/n};
 },
 coaching(frame,audio){
   const notes=[];
   if(!this.coachEnabled) return notes;
   if(frame){
     if(frame.meanLuma<55) notes.push({level:'FIX',code:'LIGHT_LOW',text:'Image is dark. Add light or move toward the light.'});
     else if(frame.meanLuma>205) notes.push({level:'FIX',code:'LIGHT_HIGH',text:'Image is very bright. Reduce light or exposure.'});
     if(frame.highlightFraction>.12) notes.push({level:'CHECK',code:'HIGHLIGHTS',text:'Bright areas are clipping. Check face/highlights.'});
     if(frame.darkFraction>.35) notes.push({level:'CHECK',code:'SHADOWS',text:'Large areas are in deep shadow.'});
   }
   if(audio?.rms!=null){
     if(audio.clip) notes.push({level:'FIX',code:'AUDIO_CLIP',text:'Audio is clipping. Lower input level or move farther from the mic.'});
     else if(audio.rms<.012) notes.push({level:'CHECK',code:'AUDIO_LOW',text:'Dialogue level is low. Move closer or check microphone.'});
   }
   // Framing suggestion is intentionally user-guided unless a real person/face detector is present.
   if(this.targetMode==='PARTNER_MARK') notes.push({level:'INFO',code:'EYELINE',text:'Partner mark is active. Use the designated eyeline target.'});
   if(this.targetMode==='PROMPTER') notes.push({level:'INFO',code:'PROMPTER',text:'Sides overlay is active. Cue-aware advance can remain manual on low confidence.'});
   return notes;
 },
 _loop(){
   const frame=this.frameStats(), audio=this.audioStats();
   const result={frame,audio,notes:this.coaching(frame,audio),facing:this.facing,at:Date.now()};
   this.last=result;
   global.dispatchEvent(new CustomEvent('actoros:camera-metrics',{detail:result}));
   this.raf=requestAnimationFrame(()=>this._loop());
 },
 async deviceSummary(){
   const track=this.stream?.getVideoTracks?.()[0];
   const settings=track?.getSettings?.()||{};
   const caps=track?.getCapabilities?.()||{};
   return {label:track?.label||'',settings,capabilities:caps,facing:this.facing};
 }
};
global.ActorOSCamera=Cam;
})(window);
