/* ===== QR =====
   No library. Byte mode, level M, smallest version that fits - which is all a
   short URL needs. Drawn to canvas so it can sit on a slate card. */
(function(g){
const A={};
const EC={1:[10,7,17,13],2:[16,10,28,22],3:[26,15,44,36],4:[36,20,64,52],
          5:[48,26,86,72],6:[64,36,108,96],7:[72,40,124,108],8:[88,48,154,132]};
// data codewords per version at level M
const CAP={1:16,2:28,3:44,4:64,5:86,6:108,7:124,8:154};
const ECW={1:10,2:16,3:26,4:18,5:24,6:16,7:18,8:22};
const BLOCKS={1:1,2:1,3:1,4:2,5:2,6:4,7:4,8:4};
const ALIGN={1:[],2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42]};

let EXP=[],LOG=[];
(function(){ let x=1;
 for(let i=0;i<255;i++){ EXP[i]=x; LOG[x]=i; x<<=1; if(x&256)x^=285; }
 for(let i=255;i<512;i++)EXP[i]=EXP[i-255];
})();
function gmul(a,b){ return (a&&b)?EXP[(LOG[a]+LOG[b])%255]:0; }
function genPoly(n){ let p=[1];
 for(let i=0;i<n;i++){ const q=[...p,0];
  for(let j=0;j<p.length;j++) q[j+1]^=gmul(p[j],EXP[i]);
  p=q; }
 return p;
}
function ecBytes(data,n){
 const gp=genPoly(n), res=[...data,...new Array(n).fill(0)];
 for(let i=0;i<data.length;i++){
  const c=res[i]; if(!c)continue;
  for(let j=0;j<gp.length;j++) res[i+j]^=gmul(gp[j],c);
 }
 return res.slice(data.length);
}
function pickVersion(len){
 for(let v=1;v<=8;v++){ const bits=4+(v<10?8:16)+len*8; if(Math.ceil(bits/8)<=CAP[v])return v; }
 return 0;
}
A.make=function(text){
 const bytes=[...new TextEncoder().encode(text)];
 const v=pickVersion(bytes.length);
 if(!v) return null;                          // too long for a small symbol
 const size=17+v*4, cap=CAP[v];
 // bit stream
 let bits=[];
 const push=(val,n)=>{ for(let i=n-1;i>=0;i--)bits.push((val>>i)&1); };
 push(4,4); push(bytes.length,8);
 bytes.forEach(b=>push(b,8));
 if(bits.length<cap*8) push(0,Math.min(4,cap*8-bits.length));
 while(bits.length%8) bits.push(0);
 const dc=[]; for(let i=0;i<bits.length;i+=8){ let b=0; for(let j=0;j<8;j++)b=(b<<1)|bits[i+j]; dc.push(b); }
 const PAD=[0xEC,0x11]; let pi=0;
 while(dc.length<cap) dc.push(PAD[pi++%2]);
 const ec=ecBytes(dc,ECW[v]);
 const all=[...dc,...ec];

 // matrix
 const m=Array.from({length:size},()=>new Array(size).fill(null));
 const set=(r,c,v2)=>{ if(r>=0&&r<size&&c>=0&&c<size)m[r][c]=v2; };
 const finder=(r,c)=>{ for(let i=-1;i<8;i++)for(let j=-1;j<8;j++){
   const rr=r+i, cc=c+j;
   if(rr<0||cc<0||rr>=size||cc>=size)continue;
   const on=(i>=0&&i<=6&&(j===0||j===6))||(j>=0&&j<=6&&(i===0||i===6))||(i>=2&&i<=4&&j>=2&&j<=4);
   set(rr,cc,on?1:0); }; };
 finder(0,0); finder(0,size-7); finder(size-7,0);
 for(let i=8;i<size-8;i++){ const b=(i%2===0)?1:0; set(6,i,b); set(i,6,b); }
 ALIGN[v].forEach(r=>ALIGN[v].forEach(c=>{
   if((r<9&&c<9)||(r<9&&c>size-10)||(r>size-10&&c<9))return;
   for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)
     set(r+i,c+j,(Math.abs(i)===2||Math.abs(j)===2||(i===0&&j===0))?1:0);
 }));
 set(size-8,8,1);
 // reserve format areas
 for(let i=0;i<9;i++){ if(m[8][i]===null)m[8][i]=0; if(m[i][8]===null)m[i][8]=0; }
 for(let i=size-8;i<size;i++){ if(m[8][i]===null)m[8][i]=0; if(m[i][8]===null)m[i][8]=0; }

 // place data, mask 0
 let bi=0, up=true;
 for(let col=size-1;col>0;col-=2){
  if(col===6)col--;
  for(let k=0;k<size;k++){
   const row=up?size-1-k:k;
   for(let c2=0;c2<2;c2++){
    const cc=col-c2;
    if(m[row][cc]!==null)continue;
    let bit=0;
    if(bi<all.length*8){ bit=(all[bi>>3]>>(7-(bi&7)))&1; bi++; }
    if((row+cc)%2===0) bit^=1;                 // mask 0
    m[row][cc]=bit;
   }
  }
  up=!up;
 }
 // format info for level M, mask 0
 const fmt=0x5412;
 const fbits=[]; for(let i=14;i>=0;i--)fbits.push((fmt>>i)&1);
 const fpos1=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
 fpos1.forEach((p,i)=>{ m[p[0]][p[1]]=fbits[i]; });
 const fpos2=[[size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],
              [8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2],[8,size-1]];
 fpos2.forEach((p,i)=>{ m[p[0]][p[1]]=fbits[i]; });
 return m.map(r=>r.map(x=>x?1:0));
};
A.draw=function(matrix,canvas,px,quiet){
 if(!matrix)return;
 const n=matrix.length, q=(quiet===undefined?4:quiet), s=px||4;
 canvas.width=(n+q*2)*s; canvas.height=(n+q*2)*s;
 const c=canvas.getContext('2d');
 c.fillStyle='#fff'; c.fillRect(0,0,canvas.width,canvas.height);
 c.fillStyle='#000';
 for(let r=0;r<n;r++)for(let col=0;col<n;col++)
  if(matrix[r][col]) c.fillRect((col+q)*s,(r+q)*s,s,s);
};
g.ActorQR=A;
})(window);
