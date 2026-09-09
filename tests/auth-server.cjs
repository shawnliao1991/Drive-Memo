const assert=require('node:assert/strict');
(async()=>{
 const {createHandler}=await import('../server/auth-server.mjs');
 const {createFirestoreStore}=await import('../server/firestore-store.mjs');
 const origin='https://memo.test',records=new Map();let refreshCalls=0,googleError=null;
 const store={get:async id=>records.get(id),set:async(id,value)=>records.set(id,value),delete:async id=>records.delete(id)};
 const fetchImpl=async(url,options)=>{
  if(url.includes('userinfo'))return{ok:true,json:async()=>({email:'owner@test',email_verified:true})};
  if(options.body.get('grant_type')==='refresh_token'){refreshCalls++;if(googleError)return{ok:false,json:async()=>({error:googleError})}}
  return{ok:true,json:async()=>({access_token:'access-'+refreshCalls,refresh_token:'private-refresh-token',expires_in:3600})};
 };
 const make=()=>createHandler({origin,clientId:'id',clientSecret:'secret',allowedEmail:'owner@test',store,fetchImpl});
 async function call(handler,url,method='GET',headers={}){const result={headers:{},status:200};await handler({url,method,headers},{setHeader:(k,v)=>result.headers[k.toLowerCase()]=v,writeHead:(status,h)=>{result.status=status;for(const[k,v]of Object.entries(h||{}))result.headers[k.toLowerCase()]=v},end:body=>result.body=body});return result}
 let handler=make();const login=await call(handler,'/auth/login');assert.equal(login.status,302);
 const redirect=new URL(login.headers.location),state=redirect.searchParams.get('state'),binding=login.headers['set-cookie'].split(';')[0];
 assert.equal(redirect.searchParams.get('access_type'),'offline');assert(redirect.searchParams.get('code_challenge'));
 handler=make(); // OAuth callback must survive a cold start.
 assert.equal((await call(handler,'/auth/callback?state='+state+'&code=code')).status,400);
 const callback=await call(handler,'/auth/callback?state='+state+'&code=code','GET',{cookie:binding});assert.equal(callback.status,200);
 const cookie=callback.headers['set-cookie'][0].split(';')[0];assert(callback.headers['set-cookie'][0].includes('HttpOnly'));assert(callback.headers['set-cookie'][0].includes('Secure'));
 assert.equal((await call(handler,'/auth/callback?state='+state+'&code=code','GET',{cookie:binding})).status,400);
 const headers={cookie,origin,'x-drive-memo':'1'};
 assert.equal((await call(handler,'/auth/token','POST',{cookie})).status,403);
 assert.equal((await call(handler,'/auth/token','POST',{origin,'x-drive-memo':'1'})).status,401);
 const pair=await Promise.all([call(handler,'/auth/token','POST',headers),call(handler,'/auth/token','POST',headers)]);assert(pair.every(x=>x.status===200));assert.equal(refreshCalls,1);assert(!pair[0].body.includes('private-refresh-token'));
 handler=make();assert.equal((await call(handler,'/auth/token','POST',headers)).status,200);assert.equal(refreshCalls,2);
 googleError='temporarily_unavailable';assert.equal((await call(handler,'/auth/token','POST',{...headers,'x-drive-memo-refresh':'1'})).status,503);assert.equal(records.size,1);
 googleError='invalid_grant';assert.equal((await call(handler,'/auth/token','POST',{...headers,'x-drive-memo-refresh':'1'})).status,401);assert.equal(records.size,0);
 for(const file of ['/.git/config','/server/auth-server.mjs','/personal/tokens.json'])assert.equal((await call(handler,file)).status,404);
 assert(!(await call(handler,'/config.js')).body.includes('secret'));
 // Firestore values are encrypted, readable after service restart, and tamper checked.
 let payload;const firestoreFetch=async(url,options)=>{if(url.startsWith('http://metadata'))return{ok:true,json:async()=>({access_token:'service',expires_in:3600})};if(options.method==='PATCH'){payload=JSON.parse(options.body);return{ok:true}}return{ok:true,json:async()=>payload}};
 const key=Buffer.alloc(32,1),db=createFirestoreStore('test-project',key,firestoreFetch),value={refreshToken:'sensitive-refresh',expires:Date.now()+100000};
 await db.set('session',value);assert(!JSON.stringify(payload).includes(value.refreshToken));assert.deepEqual(await createFirestoreStore('test-project',key,firestoreFetch).get('session'),value);
 await assert.rejects(createFirestoreStore('test-project',Buffer.alloc(32,2),firestoreFetch).get('session'));
 console.log('PASS server offline OAuth, cold start, CSRF/state, encrypted storage, refresh, revocation and private file isolation');
})().catch(error=>{console.error(error);process.exitCode=1});
