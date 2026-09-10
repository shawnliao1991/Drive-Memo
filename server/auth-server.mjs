import http from 'node:http';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tokenURL='https://oauth2.googleapis.com/token';
const sessionDays=180,ttl=sessionDays*86400000;
const hash=value=>createHash('sha256').update(value).digest('hex');
const random=()=>randomBytes(32).toString('base64url');
export function createStore(filename,key){
 let records={},writes=Promise.resolve();
 return {
  async load(){try{const bytes=await readFile(filename),decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));records=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString())}catch(error){if(error.code!=='ENOENT')throw error}},
  get(id){const value=records[hash(id)];return value&&value.expires>Date.now()?value:null},
  async set(id,value){records[hash(id)]=value;return this.save()},
  async delete(id){delete records[hash(id)];return this.save()},
  save(){const snapshot=JSON.stringify(Object.fromEntries(Object.entries(records).filter(([,r])=>r.expires>Date.now())));const operation=writes.catch(()=>{}).then(async()=>{await mkdir(path.dirname(filename),{recursive:true,mode:0o700});const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),encrypted=Buffer.concat([cipher.update(snapshot),cipher.final()]);await writeFile(filename+'.tmp',Buffer.concat([iv,cipher.getAuthTag(),encrypted]),{mode:0o600});await rename(filename+'.tmp',filename)});writes=operation;return operation}
 };
}
export function createHandler({origin,clientId,clientSecret,allowedEmail,store,fetchImpl=fetch}){
 const publicURL=new URL(origin),secure=publicURL.protocol==='https:',cookieName=secure?'__Host-driveMemo':'driveMemoDev';
 const refreshes=new Map(),tokens=new Map();
 const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(part=>{const at=part.indexOf('=');return at<0?['','']:[part.slice(0,at).trim(),part.slice(at+1)]}));
 const cookie=(name,value,seconds)=>name+'='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+seconds+(secure?'; Secure':'');
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 async function googleToken(params){
  const response=await fetchImpl(tokenURL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,...params}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();if(!response.ok||!result.access_token){const error=new Error('Google token exchange failed');error.invalidGrant=result.error==='invalid_grant';throw error}return result;
 }
 async function access(id,record,force){
  if(refreshes.has(id))return refreshes.get(id);
  const cached=tokens.get(id);if(!force&&cached&&cached.expires>Date.now()+60000)return cached;
  const promise=(async()=>{const result=await googleToken({grant_type:'refresh_token',refresh_token:record.refreshToken});const value={token:result.access_token,expires:Date.now()+Number(result.expires_in||3600)*1000};
   await store.set(id,{...record,refreshToken:result.refresh_token||record.refreshToken,expires:Date.now()+ttl});tokens.set(id,value);return value})();
  refreshes.set(id,promise);try{return await promise}finally{refreshes.delete(id)}
 }
 const files=new Set(['index.html','config.js','app.js','backend-auth.js','sync.js','ui.js','content.js','merge.js','outline.js','journal.js','sw.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png']);
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  try{
   const url=new URL(req.url,origin),jar=cookies(req),id=jar[cookieName];
   if(url.pathname==='/auth/login'&&req.method==='GET'){
    if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'ORIGIN_REJECTED'});
    if(!['same-origin','none'].includes(req.headers['sec-fetch-site']||'none'))return json(res,403,{error:'ORIGIN_REJECTED'});
    const state=random(),binding=random(),verifier=random();
    await store.set('oauth:'+state,{binding:hash(binding),verifier,expires:Date.now()+600000});
    const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    target.search=new URLSearchParams({client_id:clientId,redirect_uri:origin+'/auth/callback',response_type:'code',scope:'openid email https://www.googleapis.com/auth/drive',access_type:'offline',prompt:'consent',login_hint:allowedEmail,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
    res.writeHead(302,{'Location':target.href,'Set-Cookie':cookie(cookieName+'OAuth',binding,600)});return res.end();
   }
   if(url.pathname==='/auth/callback'&&req.method==='GET'){
    const state=url.searchParams.get('state'),entry=state&&await store.get('oauth:'+state);
    if(!entry||entry.expires<Date.now()||entry.binding!==hash(jar[cookieName+'OAuth']||''))return json(res,400,{error:'INVALID_OAUTH_STATE'});
    await store.delete('oauth:'+state);
    if(url.searchParams.has('error'))return json(res,400,{error:'GOOGLE_AUTH_CANCELLED'});
    const result=await googleToken({grant_type:'authorization_code',code:url.searchParams.get('code')||'',redirect_uri:origin+'/auth/callback',code_verifier:entry.verifier});
    const meResponse=await fetchImpl('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+result.access_token},signal:AbortSignal.timeout(15000)}),me=await meResponse.json();
    if(!meResponse.ok||me.email_verified!==true||String(me.email).toLowerCase()!==allowedEmail.toLowerCase())return json(res,403,{error:'ACCOUNT_NOT_ALLOWED'});
    if(!result.refresh_token)return json(res,400,{error:'OFFLINE_CONSENT_REQUIRED'});
    const next=random();await store.set(next,{email:me.email,refreshToken:result.refresh_token,expires:Date.now()+ttl});
    if(id){await store.delete(id);tokens.delete(id)}
    const nonce=random();res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'nonce-"+nonce+"'");
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Set-Cookie':[cookie(cookieName,next,sessionDays*86400),cookie(cookieName+'OAuth','',0)]});
    const target=JSON.stringify(origin).replaceAll('<','\\u003c');
    return res.end('<!doctype html><meta charset="utf-8"><title>Drive Memo</title><p>已連接 Google Drive，可以關閉此視窗。</p><script nonce="'+nonce+'">if(window.opener){window.opener.postMessage({type:"drive-memo-auth"},'+target+');window.close()}else{location.replace("/")}</script>');
   }
   if(url.pathname==='/auth/token'||url.pathname==='/auth/logout'){
    if(req.method!=='POST')return json(res,405,{error:'METHOD_NOT_ALLOWED'});
    if(req.headers.origin!==origin||req.headers['x-drive-memo']!=='1')return json(res,403,{error:'ORIGIN_REJECTED'});
    if(url.pathname==='/auth/logout'){if(id){await store.delete(id);tokens.delete(id)}res.setHeader('Set-Cookie',cookie(cookieName,'',0));return json(res,200,{ok:true})}
    const record=id&&await store.get(id);if(!record)return json(res,401,{error:'LOGIN_REQUIRED'});
    try{const value=await access(id,record,req.headers['x-drive-memo-refresh']==='1');res.setHeader('Set-Cookie',cookie(cookieName,id,sessionDays*86400));return json(res,200,{access_token:value.token,expires_in:Math.max(1,Math.floor((value.expires-Date.now())/1000)),email:record.email})}
    catch(error){if(error.invalidGrant){await store.delete(id);tokens.delete(id);res.setHeader('Set-Cookie',cookie(cookieName,'',0));return json(res,401,{error:'LOGIN_REQUIRED'})}return json(res,503,{error:'GOOGLE_TEMPORARILY_UNAVAILABLE'})}
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'METHOD_NOT_ALLOWED'});
   const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
   if(!files.has(name))return json(res,404,{error:'NOT_FOUND'});
   if(name==='config.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});return res.end('window.APP_CONFIG='+JSON.stringify({AUTH_BACKEND:true,GOOGLE_CLIENT_ID:clientId,ALLOWED_EMAIL:allowedEmail,SYNC_INTERVAL_MS:5000,AUTOSAVE_DELAY_MS:1200})+';')}
   const types={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
   const body=await readFile(path.join(root,name));res.writeHead(200,{'Content-Type':(types[path.extname(name)]||'application/octet-stream')});res.end(req.method==='HEAD'?undefined:body);
  }catch{json(res,503,{error:'SERVICE_UNAVAILABLE'})}
 };
}
export async function start(env=process.env){
 const origin=String(env.PUBLIC_ORIGIN||'').replace(/\/$/,''),url=new URL(origin);
 if(url.origin!==origin||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('PUBLIC_ORIGIN must be an HTTPS origin (HTTP only for localhost)');
 for(const key of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','ALLOWED_EMAIL','TOKEN_ENCRYPTION_KEY'])if(!env[key])throw Error('Missing '+key);
 const key=Buffer.from(env.TOKEN_ENCRYPTION_KEY,'base64');if(key.length!==32)throw Error('TOKEN_ENCRYPTION_KEY must be 32 random bytes encoded as base64');
 let store;
 if(env.FIRESTORE_PROJECT_ID){const {createFirestoreStore}=await import('./firestore-store.mjs');store=createFirestoreStore(env.FIRESTORE_PROJECT_ID,key)}
 else{if(!env.AUTH_DATA_FILE)throw Error('Set FIRESTORE_PROJECT_ID or AUTH_DATA_FILE');const filename=path.resolve(env.AUTH_DATA_FILE);if(filename.startsWith(root+path.sep)&&!filename.startsWith(path.join(root,'personal')+path.sep))throw Error('Store credentials outside the source tree or in ignored personal/');store=createStore(filename,key);await store.load()}
 const server=http.createServer(createHandler({origin,clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,allowedEmail:env.ALLOWED_EMAIL,store}));
 server.listen(Number(env.PORT||8080),env.HOST||'127.0.0.1');return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))start().catch(error=>{console.error(error.message);process.exitCode=1});
