const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 let now=Date.now(),local='',cloud='original',version=1,tokenCalls=0,tokenStatus=200,popups=0,rejectToken=false;
 const errors=[],ctx={window:{location:{origin:'https://memo.test'},addEventListener(){},open(){popups++}},document:{hidden:false},Date:class extends Date{static now(){return now}},Headers,URLSearchParams,Blob,setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},sessionStorage:{removeItem(){}},localStorage:{setItem(){}}};
 ctx.fetch=async(url,options={})=>{
  if(url==='/auth/token'){tokenCalls++;return{ok:tokenStatus===200,status:tokenStatus,json:async()=>({access_token:'access',expires_in:3600,email:'owner@test'})}}
  if(rejectToken){rejectToken=false;return{ok:false,status:401}}
  if(options.method==='PATCH'){cloud=options.body;version++}
  return{ok:true,status:200,json:async()=>({id:'file',version:String(version)}),text:async()=>cloud};
 };
 vm.createContext(ctx);for(const name of ['backend-auth.js','sync.js'])vm.runInContext(fs.readFileSync(name,'utf8'),ctx);
 const sync=ctx.window.DriveMemoSync.create({config:{AUTH_BACKEND:true,AUTOSAVE_DELAY_MS:5},getFileId:()=> 'file',getLocalContent:()=>local,applyContent:value=>local=value,onAutosaveError:message=>errors.push(message)});
 const settle=async()=>{for(let i=0;i<60&&sync.getDebugSnapshot().localDirty;i++)await new Promise(resolve=>setTimeout(resolve,5))};
 await sync.initialize();assert.equal(local,'original');assert.equal(tokenCalls,1);
 now+=3600000;local='after expiry';sync.localContentChanged();await settle();assert.equal(cloud,local);assert.equal(tokenCalls,2);assert.equal(popups,0);
 rejectToken=true;local='after Google 401';sync.localContentChanged();await settle();assert.equal(cloud,local);assert.equal(tokenCalls,3);assert.equal(popups,0);
 now+=3600000;tokenStatus=503;local='offline';sync.localContentChanged();await settle();assert.equal(local,'offline');assert(errors.length);assert(sync.getDebugSnapshot().localDirty);
 tokenStatus=200;sync.localContentChanged();await settle();assert.equal(cloud,'offline');assert.equal(popups,0);
 console.log('PASS backend integration saves after expiry and Google 401 without login, preserves edits during outage');
})().catch(error=>{console.error(error);process.exitCode=1});
