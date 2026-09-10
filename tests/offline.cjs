const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('sync.js','utf8'),storage=new Map();let cloud='original',version=1,patches=0,fail=false,race=false,quota=false;
function boot({offline=false,id='file'}={}){
 let local='',file=id;const events={},statuses=[],conflicts=[],nav={onLine:!offline};
 const ctx={window:{navigator:nav,addEventListener:(name,fn)=>events[name]=fn,DriveMemoBackendAuth:{create:()=>({initialize:async()=>true,getToken:async()=> 'test',logout:async()=>{throw Error('offline')},login(){}})}},document:{hidden:false},Headers,Date,console,setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},sessionStorage:{removeItem(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(quota)throw Error('QuotaExceededError');storage.set(k,v)},removeItem:k=>storage.delete(k)},fetch:async(url,options={})=>{if(fail)throw Error('network down');if(options.method==='PATCH'){if(race){race=false;cloud='concurrent writer';version++}if(options.headers.get('If-Match')!==String(version))return{ok:false,status:412};patches++;cloud=options.body;version++}return{ok:true,status:200,headers:{get:()=>String(version)},json:async()=>({id:file,version:String(version)}),text:async()=>cloud}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);const sync=ctx.window.DriveMemoSync.create({config:{AUTH_BACKEND:true,AUTOSAVE_DELAY_MS:5},getFileId:()=>file,getLocalContent:()=>local,applyContent:v=>local=v,onStatus:s=>statuses.push(s),onConflict:c=>conflicts.push(c)});
 return{sync,events,nav,statuses,conflicts,get local(){return local},edit(v){local=v;sync.localContentChanged()},switch(v){file=v;sync.fileIdChanged()}};
}
const wait=()=>new Promise(r=>setTimeout(r,40));
(async()=>{
 let h=boot();await h.sync.initialize();assert.equal(h.local,'original');h.nav.onLine=false;h.edit('offline memo');assert.equal(JSON.parse(storage.get('driveMemoDraft:file')).content,'offline memo');
 h=boot({offline:true});await h.sync.initialize();assert.equal(h.local,'offline memo');assert(h.sync.getDebugSnapshot().localDirty);assert.equal(patches,0);
 h.nav.onLine=true;h.events.online();await wait();assert.equal(cloud,'offline memo');assert.equal(h.sync.getDebugSnapshot().localDirty,false);
 h.nav.onLine=false;h.edit('local revision');cloud='remote revision';version++;h.nav.onLine=true;h.events.online();await wait();assert.equal(h.conflicts.length,1);assert.equal(cloud,'remote revision');
 h.edit('more local edits');assert.equal(JSON.parse(storage.get('driveMemoDraft:file')).content,'more local edits');h.sync.resolveLater();h.sync.reviewConflict();assert.equal(h.conflicts.at(-1).localContent,'more local edits');
 h=boot();await h.sync.initialize();await wait();assert.equal(h.local,'more local edits');assert.equal(h.conflicts.length,1);
 cloud='newer remote revision';version++;await h.sync.resolveMerged('chosen merge');assert(h.sync.getDebugSnapshot().conflictActive);assert.equal(cloud,'newer remote revision');
 await h.sync.resolveMerged('final merge');assert.equal(cloud,'final merge');assert([...storage.keys()].some(k=>k.includes('before-merge')));
 fail=true;h.edit('retry after failure');await wait();assert(h.sync.getDebugSnapshot().localDirty);fail=false;await h.sync.syncCheck();await wait();assert.equal(cloud,'retry after failure');
 race=true;h.edit('race local');await wait();assert(h.sync.getDebugSnapshot().conflictActive);assert.equal(cloud,'concurrent writer');quota=true;await assert.rejects(h.sync.resolveMerged('race merged'),/備份/);assert.equal(cloud,'concurrent writer');assert(h.sync.getDebugSnapshot().conflictActive);quota=false;await h.sync.resolveMerged('retry after failure');
 await h.sync.logout();h.edit('after logout');await wait();assert.equal(cloud,'retry after failure');h=boot();await h.sync.initialize();assert.equal(h.local,'after logout');await h.sync.syncCheck();assert.equal(cloud,'retry after failure');
 h.switch('other-file');assert.equal(h.local,'');h.edit('other notes');h.switch('file');assert.equal(h.local,'after logout');
 storage.clear();h=boot({offline:true,id:''});await h.sync.initialize();h.edit('unassigned quick memo');h.switch('new-file');assert.equal(h.local,'unassigned quick memo');assert(h.sync.getDebugSnapshot().localDirty);
 console.log('PASS offline reload, reconnect, conflict persistence, manual merge recheck, retry, logout and file isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
