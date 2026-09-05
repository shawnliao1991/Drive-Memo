(function(global){
"use strict";

function create(options={}){
 const cfg=options.config||{},noop=()=>{};
 const getFileId=options.getFileId||(()=>""),getLocalContent=options.getLocalContent||(()=>"");
 const applyContent=options.applyContent||noop,onStatus=options.onStatus||noop,onDirty=options.onDirty||noop,onMeta=options.onMeta||noop,onIdentity=options.onIdentity||noop,onConnected=options.onConnected||noop,onConflict=options.onConflict||noop,onConflictResolved=options.onConflictResolved||noop;
 const SYNC_INTERVAL=cfg.SYNC_INTERVAL_MS||5000,AUTOSAVE_DELAY=cfg.AUTOSAVE_DELAY_MS||1200;
 let accessToken=null,tokenExpiresAt=0,tokenClient=null;
 let baseVersion=null,baseContent="",currentMeta=null,localDirty=false,saving=false,saveQueued=false,syncTimer=null,autosaveTimer=null,conflictActive=false,pendingConflict=null;

 function setStatus(text,kind=""){onStatus(text,kind)}
 function setDirty(value){localDirty=value;onDirty(value)}
 function accessTokenValid(){return accessToken&&tokenExpiresAt>Date.now()+15000}
 function storeSession(){if(!accessToken)return;sessionStorage.setItem("driveMemoAccessToken",accessToken);sessionStorage.setItem("driveMemoTokenExpiresAt",String(tokenExpiresAt));sessionStorage.setItem("driveMemoIdentity",options.getIdentity?.()||"")}
 function clearSession(){["driveMemoAccessToken","driveMemoTokenExpiresAt","driveMemoIdentity"].forEach(key=>sessionStorage.removeItem(key))}
 function restoreSession(){const token=sessionStorage.getItem("driveMemoAccessToken"),expires=Number(sessionStorage.getItem("driveMemoTokenExpiresAt")||0);if(token&&expires>Date.now()+30000){accessToken=token;tokenExpiresAt=expires;onIdentity(sessionStorage.getItem("driveMemoIdentity")||"已連接");onConnected(true);return true}clearSession();return false}
 function stopSyncLoop(){if(syncTimer)clearInterval(syncTimer);syncTimer=null}
 function clearAuth(message="已登出"){accessToken=null;tokenExpiresAt=0;clearSession();onConnected(false);onIdentity("");stopSyncLoop();setStatus(message,"err")}
 async function waitForGoogleIdentity(){for(let i=0;i<120;i++){if(global.google?.accounts?.oauth2)return;await new Promise(resolve=>setTimeout(resolve,50))}throw new Error("Google Identity Services 未載入")}

 async function apiFetch(url,fetchOptions={}){
  if(!accessTokenValid()){clearAuth("Google 權限已到期，請點「連接 Google」重新連接");throw new Error("AUTH_EXPIRED")}
  const headers=new Headers(fetchOptions.headers||{});headers.set("Authorization",`Bearer ${accessToken}`);const response=await fetch(url,{...fetchOptions,headers});
  if(response.status===401){clearAuth("Google 權限已到期，請重新連接");throw new Error("AUTH_EXPIRED")}return response
 }
 async function apiJson(url,fetchOptions={}){const response=await apiFetch(url,fetchOptions);if(!response.ok){const text=await response.text();throw new Error(`${response.status} ${text.slice(0,250)}`)}return response.json()}
 async function fetchMetadata(id){return apiJson(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,version,modifiedTime,size`)}
 async function fetchContent(id){const response=await apiFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`);if(!response.ok){const text=await response.text();throw new Error(`${response.status} ${text.slice(0,250)}`)}return response.text()}
 function updateMeta(meta){currentMeta=meta;baseVersion=String(meta.version??"");onMeta(meta)}

 async function initAuth(){
  await waitForGoogleIdentity();const clientId=cfg.GOOGLE_CLIENT_ID||"";
  if(!clientId||clientId.startsWith("PASTE_")){setStatus("請先在 config.js 填入 Google OAuth Client ID","err");return}
  tokenClient=global.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:"openid email https://www.googleapis.com/auth/drive",callback:async response=>{
   if(response.error){setStatus(`Google 授權失敗：${response.error}`,"err");return}
   accessToken=response.access_token;tokenExpiresAt=Date.now()+((response.expires_in||3600)*1000);
   try{const me=await apiJson("https://www.googleapis.com/oauth2/v3/userinfo"),allowed=(cfg.ALLOWED_EMAIL||"").trim().toLowerCase();if(allowed&&me.email?.toLowerCase()!==allowed){accessToken=null;clearSession();setStatus(`帳號 ${me.email} 不在允許名單內`,"err");return}onIdentity(me.email||"已連接");onConnected(true);storeSession();setStatus("Google 已連接","ok");if(getFileId())await openCurrentFile()}catch(error){clearAuth(`帳號驗證失敗：${error.message}`)}
  }})
 }

 function requestLogin(){if(!tokenClient)return setStatus("OAuth 尚未初始化","err");tokenClient.requestAccessToken({prompt:""})}
 function logout(){if(accessToken&&global.google?.accounts?.oauth2)global.google.accounts.oauth2.revoke(accessToken);clearAuth("已登出")}
 function saveFileId(){const id=getFileId().trim();if(id)localStorage.setItem("driveMemoFileId",id)}
 function startSyncLoop(){stopSyncLoop();syncTimer=setInterval(syncCheck,SYNC_INTERVAL)}

 async function openCurrentFile(){
  const id=getFileId().trim();if(!id)return setStatus("請先輸入 Drive File ID","err");saveFileId();setStatus("讀取 Drive…","sync");
  try{const[meta,content]=await Promise.all([fetchMetadata(id),fetchContent(id)]);applyContent(content);baseContent=content;setDirty(false);updateMeta(meta);setStatus("已同步","ok");startSyncLoop()}catch(error){if(error.message!=="AUTH_EXPIRED")setStatus(`讀取失敗：${error.message}`,"err")}
 }

 function showConflict(data){conflictActive=true;pendingConflict=data;clearTimeout(autosaveTimer);autosaveTimer=null;setStatus("同步衝突：等待你選擇版本","err");onConflict(data)}
 function backupConflict(label,content){try{localStorage.setItem(`driveMemoBackup:${getFileId()}:${Date.now()}:${label}`,content)}catch{}}
 function scheduleAutosave(){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{autosaveTimer=null;saveNow()},AUTOSAVE_DELAY)}

 async function saveNow({force=false}={}){
  if(conflictActive||!localDirty)return;if(saving){saveQueued=true;return}
  const id=getFileId().trim();if(!id)return;clearTimeout(autosaveTimer);autosaveTimer=null;saving=true;saveQueued=false;
  const contentToSave=getLocalContent();let saveCompleted=false;setStatus("儲存中…","sync");
  try{
   if(!force){const before=await fetchMetadata(id);if(baseVersion&&String(before.version)!==String(baseVersion)){const cloud=await fetchContent(id),latestLocal=getLocalContent();if(cloud===latestLocal){baseContent=cloud;updateMeta(before);setDirty(false);saveCompleted=true;setStatus("已同步","ok");return}if(cloud===contentToSave){baseContent=cloud;updateMeta(before);setDirty(latestLocal!==baseContent);saveCompleted=true;setStatus(localDirty?"雲端已有上一批修改，繼續同步…":"已儲存並同步",localDirty?"sync":"ok");return}if(cloud!==baseContent){showConflict({meta:before,cloudContent:cloud,localContent:latestLocal});return}updateMeta(before)}}
   const response=await apiFetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(id)}?uploadType=media&fields=id,name,version,modifiedTime,size`,{method:"PATCH",headers:{"Content-Type":"text/markdown; charset=utf-8"},body:contentToSave});
   if(!response.ok){const text=await response.text();throw new Error(`${response.status} ${text.slice(0,250)}`)}
   const meta=await response.json();baseContent=contentToSave;updateMeta(meta);setDirty(getLocalContent()!==baseContent);saveCompleted=true;setStatus(localDirty?"已儲存上一批修改，繼續同步…":"已儲存並同步",localDirty?"sync":"ok")
  }catch(error){if(error.message!=="AUTH_EXPIRED")setStatus(`儲存失敗：${error.message}`,"err")}
  finally{saving=false;if(saveCompleted&&saveQueued&&localDirty&&!conflictActive){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{autosaveTimer=null;saveNow()},0)}}
 }

 async function syncCheck(){
  if(!accessTokenValid()||!getFileId().trim()||saving||conflictActive||document.hidden)return;
  try{const meta=await fetchMetadata(getFileId().trim());if(!baseVersion){await openCurrentFile();return}if(String(meta.version)===String(baseVersion))return;setStatus("發現雲端更新…","sync");const cloud=await fetchContent(getFileId().trim()),latestLocal=getLocalContent();if(cloud===latestLocal){baseContent=cloud;setDirty(false);updateMeta(meta);setStatus("已同步","ok");return}if(cloud===baseContent){updateMeta(meta);if(localDirty){setStatus("已確認雲端上一批修改，繼續同步…","sync");scheduleAutosave()}else setStatus("已同步","ok");return}if(!localDirty){applyContent(cloud);baseContent=cloud;updateMeta(meta);setStatus("已自動載入另一裝置的更新","ok");return}showConflict({meta,cloudContent:cloud,localContent:latestLocal})}catch(error){if(error.message!=="AUTH_EXPIRED"){console.warn(error);setStatus("同步檢查暫時失敗，稍後自動重試","err")}}
 }

 function localContentChanged(){if(conflictActive)return;setDirty(getLocalContent()!==baseContent);if(localDirty)scheduleAutosave()}
 function fileIdChanged(){saveFileId();baseVersion=null;baseContent="";setDirty(false);if(accessTokenValid())openCurrentFile()}
 function resolveUseCloud(){if(!pendingConflict)return;backupConflict("local-discarded",pendingConflict.localContent);applyContent(pendingConflict.cloudContent);baseContent=pendingConflict.cloudContent;updateMeta(pendingConflict.meta);setDirty(false);conflictActive=false;pendingConflict=null;onConflictResolved();setStatus("已採用雲端版本；本機舊版已留在瀏覽器備份","ok")}
 async function resolveKeepLocal(){if(!pendingConflict)return;backupConflict("cloud-overwritten",pendingConflict.cloudContent);updateMeta(pendingConflict.meta);conflictActive=false;pendingConflict=null;onConflictResolved();setDirty(true);await saveNow({force:true})}
 function resolveLater(){setStatus("衝突尚未處理；自動儲存暫停","err")}
 function reportStatus(text,kind=""){setStatus(text,kind)}
 function getDebugSnapshot(){return{baseVersion,baseContent,currentMeta,localDirty,saving,saveQueued,conflictActive}}
 async function initialize(){const restored=restoreSession();await initAuth();if(restored){setStatus("已恢復目前瀏覽器工作階段","ok");if(getFileId())await openCurrentFile()}}

 return Object.freeze({initialize,requestLogin,logout,openCurrentFile,syncCheck,localContentChanged,fileIdChanged,resolveUseCloud,resolveKeepLocal,resolveLater,reportStatus,getDebugSnapshot});
}

global.DriveMemoSync=Object.freeze({create});
})(window);
