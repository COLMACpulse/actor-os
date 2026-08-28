
(function(g){
'use strict';
const P={
 stream:null,video:null,canvas:null,ctx:null,facing:'environment',format:'CASTING',assist:'PARTNER_MARK',coach:true,
 formatSpec(m){return {
  CASTING:{orientation:'landscape',aspect:'16:9',w:1920,h:1080,fps:30},
  SOCIAL:{orientation:'portrait',aspect:'9:16',w:1080,h:1920,fps:30},
  CINEMATIC:{orientation:'landscape',aspect:'16:9',w:1920,h:1080,fps:30,capabilityRequired:true}
 }[m]||this.formatSpec('CASTING')},
 async open(video,canvas){
  this.stop(); this.video=video; this.canvas=canvas; this.ctx=canvas.getContext('2d',{willReadFrequently:true});
  const s=this.formatSpec(this.format);
  this.stream=await navigator.mediaDevices.getUserMedia({
   video:{facingMode:{ideal:this.facing},width:{ideal:s.w},height:{ideal:s.h},frameRate:{ideal:s.fps}},
   audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}
  });
  video.srcObject=this.stream; await video.play().catch(()=>{});
  const t=this.stream.getVideoTracks()[0];
  return {settings:t.getSettings?.()||{},capabilities:t.getCapabilities?.()||{},cinematicNative:false};
 },
 stop(){if(this.stream)this.stream.getTracks().forEach(t=>t.stop());this.stream=null},
 async switchFacing(){this.facing=this.facing==='user'?'environment':'user';return this.open(this.video,this.canvas)},
 frameMetrics(){
  const v=this.video,c=this.canvas,x=this.ctx;if(!v||!v.videoWidth)return null;
  const W=180,H=Math.max(100,Math.round(W*v.videoHeight/v.videoWidth));c.width=W;c.height=H;x.drawImage(v,0,0,W,H);
  const d=x.getImageData(0,0,W,H).data;let sum=0,dark=0,bright=0;
  for(let i=0;i<d.length;i+=4){const y=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];sum+=y;if(y<35)dark++;if(y>235)bright++}
  const n=d.length/4;return {meanLuma:sum/n,darkFraction:dark/n,highlightFraction:bright/n}
 },
 notes(f){
  if(!this.coach)return [];
  const n=[];
  if(f){
   if(f.meanLuma<55)n.push(['FIX','Too dark. Add light, move toward the light, or raise exposure.']);
   if(f.meanLuma>205)n.push(['FIX','Too bright. Reduce light or exposure.']);
   if(f.highlightFraction>.12)n.push(['CHECK','Highlights are clipping. Check face and bright background areas.']);
   if(f.darkFraction>.35)n.push(['CHECK','Large areas are in deep shadow.']);
  }
  if(this.format==='CASTING'&&innerHeight>innerWidth)n.push(['CHECK','Casting mode expects landscape. Rotate before recording.']);
  if(this.format==='SOCIAL'&&innerWidth>innerHeight)n.push(['CHECK','Social mode expects vertical 9:16. Rotate before recording.']);
  if(this.assist==='PARTNER_MARK')n.push(['INFO','Partner mark active. Use the designated eyeline target.']);
  if(this.assist==='PROMPTER')n.push(['INFO','Smart sides active. Low-confidence cues must not auto-advance.']);
  return n
 },
 packagePlan(){
  const s=this.formatSpec(this.format);
  return {captureIntent:this.format,orientation:s.orientation,aspect:s.aspect,preserveMaster:true,
   masterRule:'Never replace the original master with a derivative.',
   derivatives:this.format==='CASTING'?['CASTING_MASTER','OPTIONAL_SOCIAL_DERIVATIVE']:
    this.format==='SOCIAL'?['SOCIAL_MASTER','OPTIONAL_LANDSCAPE_DERIVATIVE']:
    ['CINEMATIC_MASTER','DESTINATION_DERIVATIVES']}
 }
};
g.ActorOSPerformerCamera=P;
})(window);
