(function(global){
"use strict";

function create(options={}){
 const cfg=options.config||{},noop=()=>{};
 const getFileId=options.getFileId||(()=>""),getLocalContent=options.getLocalContent||(()=>"");
 const applyContent=options.applyContent||noop,onStatus=options.onStatus||noop,onDirty=options.onDirty||noop,onMeta=options.onMeta||noop,onIdentity=options.onIdentity||noop,onConnected=options.onConnected||noop,onConflict=options.onConflict||noop,onConflictResolved=options.onConflictResolved||noop,onAutosaveError=options.onAutosaveError||noop;
 const SYNC_INTERVAL=cfg.SYNC_INTERVAL_MS||5000,AUTOSAVE_DELAY=cfg.AUTOSAVE_DELAY_MS||1200,TOKEN_RENEW_WINDOW=cfg.TOKEN_RENEW_WINDOW_MS||10*60*1000;
 let accessToken=null,tokenExpiresAt=0,tokenClient=null,authInit=null,automaticTokenRequest=false,tokenRenewCooldownUntil=0;
 let baseVersion=null,baseContent="",currentMeta=null,localDirty=false,saving=false,saveQueued=false,syncTimer=null,autosaveTimer=null,conflictActive=false,pendingConflict=null;
 let activeFileId=getFileId().trim(),epoch=0,loggedOut=false,storageFailed=false;
 const offline=()=>global.navigator?.onLine===false;
 const draftKey=id=>`driveMemoDraft:${id||"local"}`;
 function persistLocal(){try{localStorage.setItem(draftKey(activeFileId),JSON.stringify({schema:1,content:getLocalContent(),baseContent,baseVersion,currentMeta,localDirty,updatedAt:new Date().toISOString()}));storageFailed=false;return true}catch{storageFailed=true;setStatus("無法寫入本機備份，請先匯出備份再關閉頁面","err");return false}}
 function restoreLocal(){try{const raw=localStorage.getItem(draftKey(activeFileId));if(!raw)return false;const data=JSON.parse(raw);if(data.schema!==1||typeof data.content!=="string"||typeof data.baseContent!=="string")throw Error("invalid draft");baseContent=data.baseContent;baseVersion=data.baseVersion??null;currentMeta=data.currentMeta??null;localDirty=data.localDirty===true||data.content!==baseContent;applyContent(data.content);onMeta(currentMeta);onDirty(localDirty);setStatus(localDirty?"已還原本機筆記，等待連線同步":"已載入本機副本","ok");return true}catch{setStatus("本機備份無法讀取；請先匯出備份，避免遺失","err");return false}}
 const backend=cfg.AUTH_BACKEND?global.DriveMemoBackendAuth.create({onIdentity,onConnected,onStatus,onReady:async()=>{startSyncLoop();await resumeAfterLogin()}}):null;

 function setStatus(text,kind=""){onStatus(storageFailed?"無法寫入本機備份，請先匯出備份再關閉頁面":text,storageFailed?"err":kind)}
 function setDirty(value){localDirty=value;onDirty(value);persistLocal()}
 function accessTokenValid(){return accessToken&&tokenExpiresAt>Date.now()+15000}
 function storeSession(){if(!accessToken)return;try{sessionStorage.setItem("driveMemoAccessToken",accessToken);sessionStorage.setItem("driveMemoTokenExpiresAt",String(tokenExpiresAt));sessionStorage.setItem("driveMemoIdentity",options.getIdentity?.()||"")}catch{}}
 function clearSession(){try{["driveMemoAccessToken","driveMemoTokenExpiresAt","driveMemoIdentity"].forEach(key=>sessionStorage.removeItem(key))}catch{}}
 function restoreSession(){try{const token=sessionStorage.getItem("driveMemoAccessToken"),expires=Number(sessionStorage.getItem("driveMemoTokenExpiresAt")||0);if(token&&expires>Date.now()+30000){accessToken=token;tokenExpiresAt=expires;onIdentity(sessionStorage.getItem("driveMemoIdentity")||"已連接");onConnected(true);return true}clearSession();return false}catch{return false}}
 function stopSyncLoop(){if(syncTimer)clearInterval(syncTimer);syncTimer=null}
 function clearAuth(message="已登出"){accessToken=null;tokenExpiresAt=0;clearSession();onConnected(false);onIdentity("");stopSyncLoop();setStatus(message,"err")}
 async function waitForGoogleIdentity(retry=false){if(global.google?.accounts?.oauth2)return;let script=document.getElementById("googleIdentityScript");if(retry||!script){script?.remove();script=document.createElement("script");script.id="googleIdentityScript";script.src="https://accounts.google.com/gsi/client";script.async=true;script.onerror=()=>{script.dataset.failed="true"};document.head.append(script)}for(let i=0;i<300;i++){if(global.google?.accounts?.oauth2)return;if(script.dataset.failed==="true")throw new Error("Google 登入元件載入失敗，請確認網路後點登入重試");await new Promise(resolve=>setTimeout(resolve,100))}throw new Error("Google 登入元件載入逾時，請點登入重試")}

 async function apiFetch(url,fetchOptions={}){
  const requestEpoch=epoch;const check=()=>{if(requestEpoch!==epoch||loggedOut)throw Error("STALE_REQUEST")};check();if(offline())throw Error("OFFLINE");
  if(backend){const headers=new Headers(fetchOptions.headers||{});headers.set("Authorization","Bearer "+await backend.getToken());check();let response=await fetch(url,{...fetchOptions,headers});check();if(response.status===401){headers.set("Authorization","Bearer "+await backend.getToken(true));check();response=await fetch(url,{...fetchOptions,headers});check()}if(response.status===401)throw Error("AUTH_EXPIRED");return response}
  if(!accessTokenValid()){clearAuth("Google 權限已到期，請點「登入」重新連接");throw new Error("AUTH_EXPIRED")}
  const headers=new Headers(fetchOptions.headers||{});headers.set("Authorization",`Bearer ${accessToken}`);const response=await fetch(url,{...fetchOptions,headers});
  check();if(response.status===401){clearAuth("Google 權限已到期，請重新連接");throw new Error("AUTH_EXPIRED")}return response
 }
 async function apiJson(url,fetchOptions={}){const response=await apiFetch(url,fetchOptions);if(!response.ok){const text=await response.text();throw new Error(`${response.status} ${text.slice(0,250)}`)}return response.json()}
 async function fetchMetadata(id){const requestEpoch=epoch,response=await apiFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,version,modifiedTime,size`);if(!response.ok)throw Error(`讀取檔案資訊失敗：${response.status}`);const meta=await response.json();if(requestEpoch!==epoch)throw Error("STALE_REQUEST");const etag=response.headers?.get?.('ETag');return etag?{...meta,etag}:meta}
 async function fetchContent(id){const response=await apiFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`);if(!response.ok){const text=await response.text();throw new Error(`${response.status} ${text.slice(0,250)}`)}return response.text()}
 async function readCloudSnapshot(id,firstMeta){const requestEpoch=epoch;let meta=firstMeta||await fetchMetadata(id);for(let attempt=0;attempt<3;attempt++){const content=await fetchContent(id),after=await fetchMetadata(id);if(requestEpoch!==epoch)throw Error("STALE_REQUEST");if(String(meta.version)===String(after.version))return{meta:after,content};meta=after}throw Error("雲端正在更新，本機筆記已保留，稍後重試")}
 function driveQueryValue(value){return String(value||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'")}
 async function ensureProjectFolder(projectId,projectTitle){
  const rootId=String(options.getImageFolderId?.()||"").trim();if(!/^[a-zA-Z0-9_-]+$/.test(rootId))throw new Error("請先在後台設定圖片上傳資料夾 ID");
  const query=`mimeType='application/vnd.google-apps.folder' and trashed=false and '${driveQueryValue(rootId)}' in parents and appProperties has { key='driveMemoProjectId' and value='${driveQueryValue(projectId)}' }`,params=new URLSearchParams({q:query,spaces:"drive",fields:"files(id,name)",pageSize:"10"}),result=await apiJson(`https://www.googleapis.com/drive/v3/files?${params}`),folder=result.files?.[0],name=String(projectTitle||"未命名專案").slice(0,160);
  if(folder){if(folder.name!==name)await apiJson(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folder.id)}?fields=id,name`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});return folder.id}
  const created=await apiJson("https://www.googleapis.com/drive/v3/files?fields=id,name",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder",parents:[rootId],appProperties:{driveMemoProjectId:String(projectId),driveMemoType:"project-images"}})});return created.id
 }
 async function uploadProjectImage({file,projectId,projectTitle}={}){
  if(!(file instanceof Blob)||!String(file.type||"").startsWith("image/"))throw new Error("請選擇圖片檔案");if(file.size>25*1024*1024)throw new Error("圖片不可超過 25 MB");if(!projectId)throw new Error("找不到專案資料");
  const folderId=await ensureProjectFolder(projectId,projectTitle),boundary=`drive_memo_${Date.now()}_${Math.random().toString(36).slice(2)}`,metadata={name:String(file.name||`image-${Date.now()}`).slice(0,240),parents:[folderId],appProperties:{driveMemoProjectId:String(projectId),driveMemoType:"project-image"}},body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(metadata),`\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`,file,`\r\n--${boundary}--`]);
  const uploaded=await apiJson("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,thumbnailLink",{method:"POST",headers:{"Content-Type":`multipart/related; boundary=${boundary}`},body});return{...uploaded,folderId,url:uploaded.webViewLink||`https://drive.google.com/file/d/${uploaded.id}/view`}
 }
 async function fetchDriveImage(fileId){const response=await apiFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);if(!response.ok){const text=await response.text();throw new Error(`${response.status} ${text.slice(0,250)}`)}return response.blob()}
 function updateMeta(meta){currentMeta=meta;baseVersion=String(meta.version??"");onMeta(meta);persistLocal()}

function buildTokenClient(){
 if(tokenClient)return;const clientId=cfg.GOOGLE_CLIENT_ID||"";
 if(!clientId||clientId.startsWith("PASTE_"))throw new Error("請先在 config.js 填入 Google OAuth Client ID");
  tokenClient=global.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:"openid email https://www.googleapis.com/auth/drive",hint:(cfg.ALLOWED_EMAIL||"").trim(),error_callback:error=>{if(automaticTokenRequest){automaticTokenRequest=false;tokenRenewCooldownUntil=Infinity;return}setStatus(error.type==="popup_failed_to_open"?"登入視窗被阻擋，請允許彈出視窗後再點登入":"登入已取消，請再點登入","err")},callback:async response=>{
   if(loggedOut)return;const automatic=automaticTokenRequest;automaticTokenRequest=false;
   if(response.error){if(automatic){tokenRenewCooldownUntil=Infinity;return}setStatus(`Google 授權失敗：${response.error}`,"err");return}
   accessToken=response.access_token;tokenExpiresAt=Date.now()+((response.expires_in||3600)*1000);
   try{const me=await apiJson("https://www.googleapis.com/oauth2/v3/userinfo"),allowed=(cfg.ALLOWED_EMAIL||"").trim().toLowerCase();if(allowed&&me.email?.toLowerCase()!==allowed){accessToken=null;clearSession();setStatus(`帳號 ${me.email} 不在允許名單內`,"err");return}onIdentity(me.email||"已連接");onConnected(true);storeSession();setStatus("Google 已連接","ok")}catch(error){clearAuth(`帳號驗證失敗：${error.message}`);return}
   tokenRenewCooldownUntil=0;if(getFileId())startSyncLoop();
   if(automatic){setStatus("Google 連線已延長","ok");if(localDirty)scheduleAutosave();return}
   try{await resumeAfterLogin()}catch(error){if(error.message!=="AUTH_EXPIRED")setStatus(`重新同步失敗：${error.message}`,"err")}
  }})
 }

 async function resumeAfterLogin(){
  if(loggedOut||offline())return;
  const id=getFileId().trim();if(!id)return;if(!localDirty)return openCurrentFile();
  if(baseVersion){setStatus("Google 已重新連接，準備同步本機修改","sync");scheduleAutosave();return}
  const{meta,content:cloud}=await readCloudSnapshot(id),latestLocal=getLocalContent();if(cloud===latestLocal){baseContent=cloud;updateMeta(meta);setDirty(false);setStatus("已同步","ok");return}showConflict({meta,cloudContent:cloud,localContent:latestLocal})
 }

 function initAuth(retry=false){if(tokenClient)return Promise.resolve();if(authInit)return authInit;authInit=waitForGoogleIdentity(retry).then(buildTokenClient).finally(()=>{authInit=null});return authInit}
 function userActivity(){if(loggedOut||offline()||backend||!accessToken||!tokenClient||automaticTokenRequest||Date.now()<tokenRenewCooldownUntil||tokenExpiresAt-Date.now()>TOKEN_RENEW_WINDOW)return;automaticTokenRequest=true;try{tokenClient.requestAccessToken({prompt:""})}catch{automaticTokenRequest=false;tokenRenewCooldownUntil=Infinity}}
 function requestLogin(){loggedOut=false;try{localStorage.removeItem("driveMemoLoggedOut")}catch{}if(backend)return backend.login();if(automaticTokenRequest)return Promise.resolve();try{if(global.google?.accounts?.oauth2){buildTokenClient();tokenClient.requestAccessToken({prompt:""});return Promise.resolve()}setStatus("正在載入 Google 登入…","sync");return initAuth(true).then(()=>setStatus("登入已就緒，請再點一次「登入」","ok")).catch(error=>setStatus(error.message,"err"))}catch(error){setStatus(error.message,"err");return Promise.resolve()}}
 async function logout(){const token=accessToken;persistLocal();loggedOut=true;epoch++;automaticTokenRequest=false;clearTimeout(autosaveTimer);autosaveTimer=null;try{localStorage.setItem("driveMemoLoggedOut","true")}catch{}clearAuth("已登出；本機筆記已保留，可繼續離線編輯");try{if(backend)await backend.logout();else if(token&&global.google?.accounts?.oauth2)global.google.accounts.oauth2.revoke(token)}catch{setStatus("已停止本機連線並保留筆記；伺服器登出未完成，連網後可再按登出","")}}
 function saveFileId(){const id=getFileId().trim();if(id)try{localStorage.setItem("driveMemoFileId",id)}catch{}}
 function startSyncLoop(){stopSyncLoop();if(!getFileId().trim()||loggedOut)return;syncTimer=setInterval(syncCheck,SYNC_INTERVAL)}

 async function openCurrentFile(){
  if(conflictActive){reviewConflict();return}if(localDirty){persistLocal();if(!offline()&&!loggedOut)await saveNow();return}
  if(offline()||loggedOut){setStatus("目前使用本機副本，可繼續編輯","");return}
  const id=getFileId().trim();if(!id)return setStatus("請先輸入 Drive File ID","err");saveFileId();setStatus("讀取 Drive…","sync");
  const openEpoch=epoch;
  try{const{meta,content}=await readCloudSnapshot(id);if(openEpoch!==epoch)return;options.beforeRemoteApply?.();if(localDirty){if(getLocalContent()!==content){showConflict({meta,cloudContent:content,localContent:getLocalContent()});return}}applyContent(content);baseContent=content;setDirty(false);updateMeta(meta);setStatus("已同步","ok");startSyncLoop()}catch(error){if(!["AUTH_EXPIRED","STALE_REQUEST"].includes(error.message))setStatus("無法連接 Drive；可繼續使用本機筆記，稍後重試","err")}
 }

 function showConflict(data){conflictActive=true;pendingConflict={...data,baseContent};persistLocal();clearTimeout(autosaveTimer);autosaveTimer=null;setStatus("同步衝突：等待你逐項合併","err");onConflict(pendingConflict)}
 function reviewConflict(){if(pendingConflict){pendingConflict.localContent=getLocalContent();onConflict(pendingConflict)}}
 function backupConflict(label,content){try{localStorage.setItem(`driveMemoBackup:${activeFileId}:${Date.now()}:${label}`,content);return true}catch{storageFailed=true;setStatus("無法保留合併前備份，請先匯出備份","err");return false}}
 function scheduleAutosave(){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{autosaveTimer=null;saveNow()},AUTOSAVE_DELAY)}

 async function saveNow({force=false}={}){
  if(offline()||loggedOut){persistLocal();setStatus("本機已儲存，等待重新連線同步","");return}
  if(conflictActive||!localDirty)return;if(saving){saveQueued=true;return}
  const id=getFileId().trim();if(!id)return;clearTimeout(autosaveTimer);autosaveTimer=null;saving=true;saveQueued=false;
  const contentToSave=getLocalContent(),saveEpoch=epoch;let saveCompleted=false;setStatus("儲存中…","sync");
  try{
   if(!force){let before=await fetchMetadata(id);if(saveEpoch!==epoch)return;if(!baseVersion||String(before.version)!==String(baseVersion)){const snapshot=await readCloudSnapshot(id,before),cloud=snapshot.content,latestLocal=getLocalContent();before=snapshot.meta;if(saveEpoch!==epoch)return;if(cloud===latestLocal){baseContent=cloud;updateMeta(before);setDirty(false);saveCompleted=true;setStatus("已同步","ok");return}if(cloud===contentToSave){baseContent=cloud;updateMeta(before);setDirty(latestLocal!==baseContent);saveCompleted=true;setStatus(localDirty?"雲端已有上一批修改，繼續同步…":"已儲存並同步",localDirty?"sync":"ok");return}if(cloud!==baseContent){showConflict({meta:before,cloudContent:cloud,localContent:latestLocal});return}}updateMeta(before)}
   const response=await apiFetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(id)}?uploadType=media&fields=id,name,version,modifiedTime,size`,{method:"PATCH",headers:{"Content-Type":"text/markdown; charset=utf-8",...(currentMeta?.etag?{"If-Match":currentMeta.etag}:{})},body:contentToSave});
   if(response.status===412){const snapshot=await readCloudSnapshot(id);if(saveEpoch===epoch)showConflict({meta:snapshot.meta,cloudContent:snapshot.content,localContent:getLocalContent()});return}
   if(!response.ok){const text=await response.text();throw new Error(`${response.status} ${text.slice(0,250)}`)}
   const meta=await response.json();if(saveEpoch!==epoch)return;baseContent=contentToSave;updateMeta(meta);setDirty(getLocalContent()!==baseContent);saveCompleted=true;setStatus(localDirty?"已儲存上一批修改，繼續同步…":"已儲存並同步",localDirty?"sync":"ok")
  }catch(error){if(error.message==="STALE_REQUEST"||saveEpoch!==epoch)return;persistLocal();const message=error.message==="AUTH_EXPIRED"?"自動儲存失敗：Google Drive 已斷線，修改仍保留在這個瀏覽器，請重新登入":"本機已儲存；雲端同步失敗，連線恢復後重試："+error.message;if(error.message!=="AUTH_EXPIRED")setStatus(message,"err");onAutosaveError(message)}
  finally{saving=false;if(saveCompleted&&saveQueued&&localDirty&&!conflictActive){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{autosaveTimer=null;saveNow()},0)}}
 }

 async function syncCheck(){
  if(offline()||loggedOut)return;
  if(!backend&&!accessTokenValid()||!getFileId().trim()||saving||conflictActive||document.hidden)return;
  const checkEpoch=epoch;try{let meta=await fetchMetadata(getFileId().trim());if(checkEpoch!==epoch)return;if(!baseVersion){await openCurrentFile();return}if(String(meta.version)===String(baseVersion)){if(localDirty)scheduleAutosave();return}setStatus("發現雲端更新…","sync");const snapshot=await readCloudSnapshot(getFileId().trim(),meta),cloud=snapshot.content,latestLocal=getLocalContent();meta=snapshot.meta;if(checkEpoch!==epoch)return;if(cloud===latestLocal){baseContent=cloud;setDirty(false);updateMeta(meta);setStatus("已同步","ok");return}if(cloud===baseContent){updateMeta(meta);if(localDirty){setStatus("已確認雲端上一批修改，繼續同步…","sync");scheduleAutosave()}else setStatus("已同步","ok");return}options.beforeRemoteApply?.();if(!localDirty){applyContent(cloud);baseContent=cloud;updateMeta(meta);setStatus("已自動載入另一裝置的更新","ok");return}showConflict({meta,cloudContent:cloud,localContent:getLocalContent()})}catch(error){if(checkEpoch===epoch&&!["AUTH_EXPIRED","STALE_REQUEST"].includes(error.message)){console.warn(error);setStatus("同步檢查暫時失敗，稍後自動重試","err")}}
 }

 function localContentChanged(){if(saving)saveQueued=true;setDirty(getLocalContent()!==baseContent);if(conflictActive){pendingConflict.localContent=getLocalContent();return}if(localDirty)scheduleAutosave()}
 function fileIdChanged(){persistLocal();const oldId=activeFileId,oldContent=getLocalContent(),oldDirty=localDirty;epoch++;clearTimeout(autosaveTimer);activeFileId=getFileId().trim();saveFileId();baseVersion=null;baseContent="";currentMeta=null;conflictActive=false;pendingConflict=null;onConflictResolved();localDirty=false;applyContent("");if(!restoreLocal()&&!oldId&&oldDirty){applyContent(oldContent);setDirty(true)}else onDirty(localDirty);if(!loggedOut&&(backend||accessTokenValid()))openCurrentFile()}
 function resolveUseCloud(){if(!pendingConflict)return;if(!backupConflict("local-discarded",getLocalContent()))return;applyContent(pendingConflict.cloudContent);baseContent=pendingConflict.cloudContent;updateMeta(pendingConflict.meta);setDirty(false);conflictActive=false;pendingConflict=null;onConflictResolved();setStatus("已採用雲端版本；本機舊版已留在瀏覽器備份","ok")}
 async function resolveMerged(content){if(!pendingConflict)return;const data=pendingConflict;if(!backupConflict("local-before-merge",getLocalContent())||!backupConflict("cloud-before-merge",data.cloudContent))throw Error("無法保留合併前備份，請先匯出備份");baseContent=data.cloudContent;updateMeta(data.meta);applyContent(content);conflictActive=false;pendingConflict=null;setDirty(content!==baseContent);onConflictResolved();await saveNow()}
 async function resolveKeepLocal(){await resolveMerged(getLocalContent())}
 function resolveLater(){setStatus("衝突尚未處理；自動儲存暫停","err")}
 function reportStatus(text,kind=""){setStatus(text,kind)}
 function getDebugSnapshot(){return{baseVersion,baseContent,currentMeta,localDirty,saving,saveQueued,conflictActive}}
 async function initialize(){
  restoreLocal();try{loggedOut=localStorage.getItem("driveMemoLoggedOut")==="true"}catch{}
  global.addEventListener?.("offline",()=>{persistLocal();setStatus("離線模式：筆記儲存在本機","")});
  global.addEventListener?.("online",()=>{if(loggedOut)return;startSyncLoop();if(backend||accessTokenValid())resumeAfterLogin().catch(()=>setStatus("本機筆記已保留，等待雲端連線恢復", ""));else setStatus("網路已恢復，請登入以同步本機筆記","")});
  global.addEventListener?.("pagehide",persistLocal);
  if(loggedOut){clearAuth("已登出；本機筆記可繼續編輯");return}
  const restored=backend?false:restoreSession();
  if(offline()){setStatus("離線模式：已載入本機筆記","");return}
  if(backend){clearSession();const connected=await backend.initialize();if(loggedOut)return;startSyncLoop();if(connected)await resumeAfterLogin();return}
  try{await initAuth()}catch(error){setStatus(error.message,"err")}
  if(restored){startSyncLoop();if(getFileId())await resumeAfterLogin()}
 }

 return Object.freeze({initialize,requestLogin,userActivity,logout,openCurrentFile,syncCheck,localContentChanged,fileIdChanged,resolveUseCloud,resolveKeepLocal,resolveMerged,reviewConflict,persistLocal,resolveLater,reportStatus,getDebugSnapshot,uploadProjectImage,fetchDriveImage});
}

global.DriveMemoSync=Object.freeze({create});
})(window);
