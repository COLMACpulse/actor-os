
(function(global){
'use strict';
const K='actoros_physical_gauntlet_v1';
function read(){try{return JSON.parse(localStorage.getItem(K))||{events:[],runId:crypto.randomUUID?.()||String(Date.now())}}catch(e){return {events:[],runId:String(Date.now())}}}
let S=read();
function save(){localStorage.setItem(K,JSON.stringify(S))}
function event(test,status,data={}){
 const e={at:new Date().toISOString(),test,status,data};
 S.events.push(e);save();return e;
}
function last(test){return [...S.events].reverse().find(e=>e.test===test)}
function summary(){
 const names=["G01_PERMISSIONS","G02_ENUMERATION","G03_CAMERA_SELECTION","G04_FOCUS_EXPOSURE","G05_STABILIZATION","G06_CINEMATIC_TRUTH","G07_MASTER_RECORDING","G08_RELAUNCH_PERSISTENCE","G09_HASH_SURVIVAL","G10_STORAGE_BATTERY","G11_ORIENTATION_MASTER_RULE","G12_ENDURANCE_10_MASTERS"];
 const rows=names.map(t=>({test:t,status:last(t)?.status||"UNKNOWN",data:last(t)?.data||{}}));
 const fail=rows.some(r=>r.status==="FAIL");
 const unknown=rows.some(r=>r.status==="UNKNOWN");
 return {runId:S.runId,rows,overall:fail?"FAIL":unknown?"INCOMPLETE":"PASS"};
}
async function download(name,obj){
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
global.ActorOSGauntlet={event,last,summary,download,state:()=>S,reset(){S={events:[],runId:crypto.randomUUID?.()||String(Date.now())};save()}};
})(window);
