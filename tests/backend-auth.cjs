const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 let now=Date.now(),calls=0,status=200,listener,popup={},ready=0;
 const ctx={window:{location:{origin:'https://memo.test'},addEventListener:(name,fn)=>listener=fn,open:()=>popup},Date:class extends Date{static now(){return now}},fetch:async()=>{calls++;return{status,ok:status===200,json:async()=>({access_token:'token-'+calls,expires_in:3600,email:'owner@test'})}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('backend-auth.js','utf8'),ctx);
 const auth=ctx.window.DriveMemoBackendAuth.create({onReady:()=>ready++});
 assert(await auth.initialize());assert.equal(calls,1);
 await auth.getToken();assert.equal(calls,1);
 now+=3600000;await Promise.all([auth.getToken(),auth.getToken()]);assert.equal(calls,2);
 status=503;now+=3600000;await assert.rejects(auth.getToken(),/暫時/);status=200;await auth.getToken();
 auth.login();await listener({origin:'https://evil.test',source:popup,data:{type:'drive-memo-auth'}});assert.equal(ready,0);
 await listener({origin:'https://memo.test',source:{},data:{type:'drive-memo-auth'}});assert.equal(ready,0);
 await listener({origin:'https://memo.test',source:popup,data:{type:'drive-memo-auth'}});assert.equal(ready,1);
 status=401;await assert.rejects(auth.getToken(true),/AUTH_EXPIRED/);
 console.log('PASS backend silent renewal, concurrent requests, temporary outage and authenticated popup');
})().catch(error=>{console.error(error);process.exitCode=1});
