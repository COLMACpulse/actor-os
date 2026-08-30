
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
  // the slate move crops in, so it needs pixels to spend - ask for the largest
  // frame the device will give when it is enabled
  const wantW=this.wantMax?3840:s.w, wantH=this.wantMax?2160:s.h;
  this.stream=await navigator.mediaDevices.getUserMedia({
   video:{facingMode:{ideal:this.facing},width:{ideal:wantW},height:{ideal:wantH},frameRate:{ideal:s.fps}},
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

 /* ===== BACKGROUND =====
    No segmentation. Replacing or blurring a background needs an ML model, and
    when it fails it fails on hair and edges - a broken effect reads worse to
    casting than a plain wall. Their instructions also say do not edit the scene.

    What CAN be measured honestly: how busy the background is, how evenly it is
    lit, and whether you separate from it. Those are the things you can fix by
    moving, and they are measurable from pixels alone.

    Limits: it samples the outer border of the frame and assumes you are roughly
    centred. It cannot tell a picture frame from a doorway. It does not know where
    you end and the wall begins - that would need the detector this app does not
    claim to have. */
 backgroundCheck(){
  if(!this.ctx||!this.video||!this.video.videoWidth)return null;
  const W=this.canvas.width, H=this.canvas.height;
  this.ctx.drawImage(this.video,0,0,W,H);
  let d;
  try{ d=this.ctx.getImageData(0,0,W,H).data; }catch(e){ return null; }
  const at=(x,y)=>{const i=((y*W)+x)*4; return 0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2];};
  const rgbAt=(x,y)=>{const i=((y*W)+x)*4; return [d[i],d[i+1],d[i+2]];};

  // outer border - the part of frame least likely to be the actor
  const mx=Math.floor(W*0.18), my=Math.floor(H*0.12);
  let n=0, sum=0, sum2=0, edge=0, edgeN=0;
  let r=0,g=0,b=0;
  for(let y=1;y<H-1;y++){
   for(let x=1;x<W-1;x++){
    const outer = (x<mx || x>W-mx || y<my);      // sides and top, not the bottom
    if(!outer) continue;
    const L=at(x,y);
    sum+=L; sum2+=L*L; n++;
    const c=rgbAt(x,y); r+=c[0]; g+=c[1]; b+=c[2];
    // simple gradient magnitude - how much detail is back there
    const gx=Math.abs(at(x+1,y)-at(x-1,y)), gy=Math.abs(at(x,y+1)-at(x,y-1));
    if(gx+gy>26) edge++;
    edgeN++;
   }
  }
  if(!n) return null;
  const mean=sum/n, varr=Math.max(0,sum2/n-mean*mean), sd=Math.sqrt(varr);
  const busy=edge/Math.max(1,edgeN);
  r/=n; g/=n; b/=n;
  const cast=Math.max(r,g,b)-Math.min(r,g,b);

  // centre strip = mostly you. Separation is the gap between you and the wall.
  let cSum=0,cN=0;
  for(let y=Math.floor(H*0.25);y<H*0.85;y++)
   for(let x=Math.floor(W*0.38);x<W*0.62;x++){ cSum+=at(x,y); cN++; }
  const subject=cN?cSum/cN:mean;
  const separation=Math.abs(subject-mean);

  return {meanLuma:Math.round(mean*10)/10,
          evenness:Math.round(sd*10)/10,
          busy:Math.round(busy*1000)/1000,
          colourCast:Math.round(cast*10)/10,
          separation:Math.round(separation*10)/10};
 },
 backgroundNotes(bg){
  if(!bg)return [];
  const n=[];
  if(bg.busy>0.085) n.push(['FIX','Busy background. Move closer to a plain wall, or turn so the clutter is out of frame.']);
  else if(bg.busy>0.045) n.push(['CHECK','Some detail behind you. Casting wants plain - check what is in frame.']);
  if(bg.evenness>34) n.push(['CHECK','The wall is lit unevenly. Move your light back, or step away from the wall so it falls off less.']);
  if(bg.meanLuma<42) n.push(['CHECK','Background is very dark. You may separate, but it can read as murky.']);
  if(bg.meanLuma>212) n.push(['FIX','Background is blown out. Bring the light down or step away from the window.']);
  if(bg.separation<14) n.push(['FIX','You are blending into the background. Step forward, or light yourself more than the wall.']);
  if(bg.colourCast>46) n.push(['CHECK','Strong colour on the wall. Neutral reads better on tape.']);
  if(!n.length) n.push(['OK','Background is plain, evenly lit, and you separate from it.']);
  return n;
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
