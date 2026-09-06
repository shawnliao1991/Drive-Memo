const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function harness({ready=false,failed=false,storageBlocked=false,delay=0}={}){
 let tick=0,clients=0,popups=0,appends=0,callback;const status=[],script={dataset:{failed:String(failed)},remove(){}};
 const win={},sdk={accounts:{oauth2:{initTokenClient(opts){clients++;callback=opts.callback;return {requestAccessToken(){popups++}}}}}};if(ready)win.google=sdk;
 const storage={getItem(){if(storageBlocked)throw Error('SecurityError');return null},setItem(){if(storageBlocked)throw Error('SecurityError')},removeItem(){if(storageBlocked)throw Error('SecurityError')}};
 const context={window:win,document:{getElementById:()=>script,createElement:()=>({dataset:{}}),head:{append(){appends++;script.dataset.failed='false'}},hidden:false},sessionStorage:storage,localStorage:storage,Headers,Date,URLSearchParams,Blob,setTimeout(fn){tick++;if(delay&&tick>=delay)win.google=sdk;queueMicrotask(fn)},clearTimeout(){},setInterval(){},clearInterval(){},fetch:async()=>({ok:true,status:200,json:async()=>({email:'test@example.com'})})};
 vm.createContext(context);vm.runInContext(fs.readFileSync('sync.js','utf8'),context);const sync=win.DriveMemoSync.create({config:{GOOGLE_CLIENT_ID:'test-client'},onStatus:text=>status.push(text)});
 return {sync,status,win,sdk,get clients(){return clients},get popups(){return popups},get appends(){return appends},authorize:()=>callback({access_token:'fake-test-token',expires_in:3600})};
}
(async()=>{
 const slow=harness({delay:80});await slow.sync.initialize();assert.equal(slow.clients,1);slow.sync.requestLogin();assert.equal(slow.popups,1);console.log('PASS SDK loading longer than old six-second limit');
 const blocked=harness({ready:true,storageBlocked:true});await blocked.sync.initialize();blocked.sync.requestLogin();await blocked.authorize();assert.equal(blocked.popups,1);assert(blocked.status.includes('Google 已連接'));console.log('PASS restricted session storage does not break initialization or login');
 const retry=harness({failed:true,delay:3});await retry.sync.initialize();assert(retry.status.at(-1).includes('載入失敗'));await retry.sync.requestLogin();assert.equal(retry.appends,1);assert.equal(retry.popups,0);assert(retry.status.at(-1).includes('再點一次'));retry.sync.requestLogin();assert.equal(retry.popups,1);console.log('PASS failed load retry; popup only opens on next direct click');
 const timeout=harness();await timeout.sync.initialize();assert(timeout.status.at(-1).includes('逾時'));timeout.win.google=timeout.sdk;timeout.sync.requestLogin();assert.equal(timeout.popups,1);console.log('PASS late SDK after timeout recovers on login click');
 const concurrent=harness({delay:10});await Promise.all([concurrent.sync.initialize(),concurrent.sync.requestLogin(),concurrent.sync.requestLogin()]);assert.equal(concurrent.clients,1);assert.equal(concurrent.popups,0);console.log('PASS concurrent readiness requests share one initialization');
})().catch(e=>{console.error(e);process.exitCode=1});
