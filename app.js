let accessToken=null,tokenExpiresAt=0,tokenClient=null;
let baseVersion=null,baseContent="",currentMeta=null,localDirty=false,saving=false,syncTimer=null,autosaveTimer=null,conflictActive=false,pendingConflict=null;
const $=id=>document.getElementById(id),cfg=window.APP_CONFIG||{};
const loginBtn=$("loginBtn"),logoutBtn=$("logoutBtn"),openBtn=$("openBtn"),syncBtn=$("syncBtn"),fileIdEl=$("fileId"),editor=$("editor"),preview=$("preview"),statusText=$("statusText"),stateDot=$("stateDot"),fileMeta=$("fileMeta"),dirtyState=$("dirtyState"),identity=$("identity"),conflictDialog=$("conflictDialog"),diffView=$("diffView"),localConflict=$("localConflict"),cloudConflict=$("cloudConflict");
const SYNC_INTERVAL=cfg.SYNC_INTERVAL_MS||5000,AUTOSAVE_DELAY=cfg.AUTOSAVE_DELAY_MS||1200;
const UI_STATE_MARKER="DRIVE_MEMO_UI_STATE";
const UI_STATE_RE=/<!-- DRIVE_MEMO_UI_STATE\r?\n([\s\S]*?)\r?\n-->/;
const DEFAULT_UI_STATE={version:1,checked:false,switchOn:false,priority:"normal",stage:"todo",progress:25,note:"",updatedAt:""};

function setStatus(t,k=""){statusText.textContent=t;stateDot.className=`dot ${k}`}
function setDirty(v){localDirty=v;dirtyState.textContent=v?"● 本机有未同步修改":""}
function escapeHtml(s){return(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function normalizeUiState(value={}){
 const priority=["low","normal","high"].includes(value.priority)?value.priority:"normal";
 const stage=["todo","doing","waiting","done"].includes(value.stage)?value.stage:"todo";
 const progress=Math.max(0,Math.min(100,Number(value.progress)||0));
 return{version:1,checked:Boolean(value.checked),switchOn:Boolean(value.switchOn),priority,stage,progress,note:String(value.note||"").slice(0,80),updatedAt:String(value.updatedAt||"")}
}
function readUiState(markdown=editor.value){
 const match=String(markdown||"").match(UI_STATE_RE);if(!match)return{...DEFAULT_UI_STATE};
 try{return normalizeUiState(JSON.parse(match[1]))}catch(e){console.warn("互動狀態資料無法解析",e);return{...DEFAULT_UI_STATE}}
}
function withoutUiState(markdown){return String(markdown||"").replace(UI_STATE_RE,"").trimEnd()}
function statePanelHtml(s){
 const updated=s.updatedAt?` · ${escapeHtml(new Date(s.updatedAt).toLocaleString())}`:"";
 return `<section class="state-lab" aria-label="跨裝置狀態測試">
  <div class="state-lab-head"><div><h4>跨裝置狀態測試</h4><p class="muted">操作後會自動儲存到同一份 Drive 文件${updated}</p></div><span class="state-sync-badge">共 6 種控制項</span></div>
  <div class="state-grid">
   <div class="state-field"><span class="state-label">1. Checkbox</span><div class="state-check"><input id="uiStateChecked" data-state-key="checked" type="checkbox" ${s.checked?"checked":""}><label for="uiStateChecked">這件事已完成</label></div></div>
   <div class="state-field"><span class="state-label">2. 切換開關</span><label class="state-switch"><input data-state-key="switchOn" type="checkbox" ${s.switchOn?"checked":""}><span class="state-switch-track" aria-hidden="true"></span><span>${s.switchOn?"已開啟":"已關閉"}</span></label></div>
   <fieldset class="state-field" style="margin:0"><legend class="state-label">3. 單選狀態</legend><div class="state-options"><input id="priorityLow" data-state-key="priority" type="radio" name="uiPriority" value="low" ${s.priority==="low"?"checked":""}><label for="priorityLow">低</label><input id="priorityNormal" data-state-key="priority" type="radio" name="uiPriority" value="normal" ${s.priority==="normal"?"checked":""}><label for="priorityNormal">普通</label><input id="priorityHigh" data-state-key="priority" type="radio" name="uiPriority" value="high" ${s.priority==="high"?"checked":""}><label for="priorityHigh">高</label></div></fieldset>
   <div class="state-field"><label for="uiStateStage">4. 下拉階段</label><select id="uiStateStage" data-state-key="stage"><option value="todo" ${s.stage==="todo"?"selected":""}>待處理</option><option value="doing" ${s.stage==="doing"?"selected":""}>進行中</option><option value="waiting" ${s.stage==="waiting"?"selected":""}>等待中</option><option value="done" ${s.stage==="done"?"selected":""}>已完成</option></select></div>
   <div class="state-field"><label for="uiStateProgress">5. 數值滑桿</label><div class="state-range"><input id="uiStateProgress" data-state-key="progress" type="range" min="0" max="100" step="5" value="${s.progress}"><output id="uiStateProgressValue">${s.progress}%</output></div></div>
   <div class="state-field"><label for="uiStateNote">6. 短文字狀態</label><input id="uiStateNote" data-state-key="note" type="text" maxlength="80" value="${escapeHtml(s.note)}" placeholder="例如：等 Shawn 確認"></div>
  </div>
 </section>`
}
function renderPreview(){const t=editor.value||"",s=readUiState(t),body=withoutUiState(t);preview.innerHTML=statePanelHtml(s)+(window.marked?marked.parse(body):`<pre>${escapeHtml(body)}</pre>`)}
function writeUiState(patch){
 const state=normalizeUiState({...readUiState(),...patch,updatedAt:new Date().toISOString()});
 const body=withoutUiState(editor.value),block=`<!-- ${UI_STATE_MARKER}\n${JSON.stringify(state,null,2)}\n-->`;
 editor.value=body?`${body}\n\n${block}`:block;renderPreview();if(conflictActive)return;setDirty(editor.value!==baseContent);if(localDirty)scheduleAutosave()
}
function getFileId(){return fileIdEl.value.trim()}
function saveFileId(){const id=getFileId();if(id)localStorage.setItem("driveMemoFileId",id)}
function accessTokenValid(){return accessToken&&tokenExpiresAt>Date.now()+15000}
function storeSession(){if(!accessToken)return;sessionStorage.setItem("driveMemoAccessToken",accessToken);sessionStorage.setItem("driveMemoTokenExpiresAt",String(tokenExpiresAt));sessionStorage.setItem("driveMemoIdentity",identity.textContent||"")}
function restoreSession(){const t=sessionStorage.getItem("driveMemoAccessToken"),e=Number(sessionStorage.getItem("driveMemoTokenExpiresAt")||0);if(t&&e>Date.now()+30000){accessToken=t;tokenExpiresAt=e;identity.textContent=sessionStorage.getItem("driveMemoIdentity")||"已连接";setConnectedUI(true);return true}clearSession();return false}
function clearSession(){["driveMemoAccessToken","driveMemoTokenExpiresAt","driveMemoIdentity"].forEach(k=>sessionStorage.removeItem(k))}
function setConnectedUI(c){loginBtn.disabled=c;logoutBtn.disabled=!c;openBtn.disabled=!c;syncBtn.disabled=!c}
function clearAuth(m="已登出"){accessToken=null;tokenExpiresAt=0;clearSession();setConnectedUI(false);identity.textContent="";stopSyncLoop();setStatus(m,"err")}
async function waitForGoogleIdentity(){for(let i=0;i<120;i++){if(window.google?.accounts?.oauth2)return;await new Promise(r=>setTimeout(r,50))}throw new Error("Google Identity Services 未载入")}

async function initAuth(){
 await waitForGoogleIdentity();
 const id=cfg.GOOGLE_CLIENT_ID||"";
 if(!id||id.startsWith("PASTE_")){setStatus("请先在 config.js 填入 Google OAuth Client ID","err");return}
 tokenClient=google.accounts.oauth2.initTokenClient({
  client_id:id,scope:"openid email https://www.googleapis.com/auth/drive",
  callback:async resp=>{
   if(resp.error){setStatus(`Google 授权失败：${resp.error}`,"err");return}
   accessToken=resp.access_token;tokenExpiresAt=Date.now()+((resp.expires_in||3600)*1000);
   try{
    const me=await apiJson("https://www.googleapis.com/oauth2/v3/userinfo");
    const allowed=(cfg.ALLOWED_EMAIL||"").trim().toLowerCase();
    if(allowed&&me.email?.toLowerCase()!==allowed){accessToken=null;clearSession();setStatus(`帐号 ${me.email} 不在允许名单`,"err");return}
    identity.textContent=me.email||"已连接";setConnectedUI(true);storeSession();setStatus("Google 已连接","ok");
    if(getFileId())await openCurrentFile();
   }catch(e){clearAuth(`帐号验证失败：${e.message}`)}
  }
 })
}
function requestLogin(){if(!tokenClient)return setStatus("OAuth 尚未初始化","err");tokenClient.requestAccessToken({prompt:""})}
async function apiFetch(url,options={}){
 if(!accessTokenValid()){clearAuth("Google 权限已到期，请点「连接 Google」重新连接");throw new Error("AUTH_EXPIRED")}
 const h=new Headers(options.headers||{});h.set("Authorization",`Bearer ${accessToken}`);const r=await fetch(url,{...options,headers:h});
 if(r.status===401){clearAuth("Google 权限已到期，请重新连接");throw new Error("AUTH_EXPIRED")}return r
}
async function apiJson(url,options={}){const r=await apiFetch(url,options);if(!r.ok){const t=await r.text();throw new Error(`${r.status} ${t.slice(0,250)}`)}return r.json()}
async function fetchMetadata(id){return apiJson(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,version,modifiedTime,size`)}
async function fetchContent(id){const r=await apiFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`);if(!r.ok){const t=await r.text();throw new Error(`${r.status} ${t.slice(0,250)}`)}return r.text()}
function updateMeta(m){currentMeta=m;baseVersion=String(m.version??"");const w=m.modifiedTime?new Date(m.modifiedTime).toLocaleString():"";fileMeta.textContent=m.name?`${m.name}${w?" · "+w:""}`:""}

async function openCurrentFile(){
 const id=getFileId();if(!id)return setStatus("请先输入 Drive File ID","err");saveFileId();setStatus("读取 Drive…","sync");
 try{const [m,c]=await Promise.all([fetchMetadata(id),fetchContent(id)]);editor.value=c;baseContent=c;setDirty(false);updateMeta(m);renderPreview();setStatus("已同步","ok");startSyncLoop()}
 catch(e){if(e.message!=="AUTH_EXPIRED")setStatus(`读取失败：${e.message}`,"err")}
}

async function saveNow({force=false}={}){
 if(!localDirty||saving||conflictActive)return;const id=getFileId();if(!id)return;saving=true;setStatus("保存中…","sync");
 try{
  if(!force){
   const before=await fetchMetadata(id);
   if(baseVersion&&String(before.version)!==String(baseVersion)){
    const cloud=await fetchContent(id);
    if(cloud!==editor.value){showConflict({meta:before,cloudContent:cloud,localContent:editor.value});return}
    updateMeta(before)
   }
  }
  const r=await apiFetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(id)}?uploadType=media&fields=id,name,version,modifiedTime,size`,{method:"PATCH",headers:{"Content-Type":"text/markdown; charset=utf-8"},body:editor.value});
  if(!r.ok){const t=await r.text();throw new Error(`${r.status} ${t.slice(0,250)}`)}
  const m=await r.json();baseContent=editor.value;setDirty(false);updateMeta(m);setStatus("已保存并同步","ok")
 }catch(e){if(e.message!=="AUTH_EXPIRED")setStatus(`保存失败：${e.message}`,"err")}
 finally{saving=false}
}
function scheduleAutosave(){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>saveNow(),AUTOSAVE_DELAY)}

async function syncCheck(){
 if(!accessTokenValid()||!getFileId()||saving||conflictActive||document.hidden)return;
 try{
  const m=await fetchMetadata(getFileId());
  if(!baseVersion){await openCurrentFile();return}
  if(String(m.version)===String(baseVersion))return;
  setStatus("发现云端更新…","sync");const cloud=await fetchContent(getFileId());
  if(cloud===editor.value){baseContent=cloud;setDirty(false);updateMeta(m);setStatus("已同步","ok");return}
  if(!localDirty){editor.value=cloud;baseContent=cloud;updateMeta(m);renderPreview();setStatus("已自动载入另一装置的更新","ok");return}
  showConflict({meta:m,cloudContent:cloud,localContent:editor.value})
 }catch(e){if(e.message!=="AUTH_EXPIRED"){console.warn(e);setStatus("同步检查暂时失败，稍后自动重试","err")}}
}
function startSyncLoop(){stopSyncLoop();syncTimer=setInterval(syncCheck,SYNC_INTERVAL)}
function stopSyncLoop(){if(syncTimer)clearInterval(syncTimer);syncTimer=null}

function buildDiffHtml(localText,cloudText){
 if(window.Diff?.diffLines){return Diff.diffLines(localText,cloudText).map(p=>{const cls=p.added?"diff-add":p.removed?"diff-del":"diff-same",pre=p.added?"+ ":p.removed?"- ":"  ";return `<div class="${cls}">${pre}${escapeHtml(p.value)}</div>`}).join("")}
 return "<div>差异套件未载入；请比较下方本机与云端版本。</div>"
}
function showConflict(d){conflictActive=true;pendingConflict=d;clearTimeout(autosaveTimer);localConflict.textContent=d.localContent;cloudConflict.textContent=d.cloudContent;diffView.innerHTML=buildDiffHtml(d.localContent,d.cloudContent);setStatus("同步冲突：等待你选择版本","err");if(!conflictDialog.open)conflictDialog.showModal()}
function backupConflict(label,content){try{localStorage.setItem(`driveMemoBackup:${getFileId()}:${Date.now()}:${label}`,content)}catch{}}
function resolveUseCloud(){if(!pendingConflict)return;backupConflict("local-discarded",pendingConflict.localContent);editor.value=pendingConflict.cloudContent;baseContent=pendingConflict.cloudContent;updateMeta(pendingConflict.meta);setDirty(false);renderPreview();conflictActive=false;pendingConflict=null;conflictDialog.close();setStatus("已采用云端版本；本机旧版已留在浏览器备份","ok")}
async function resolveKeepLocal(){if(!pendingConflict)return;backupConflict("cloud-overwritten",pendingConflict.cloudContent);updateMeta(pendingConflict.meta);conflictActive=false;conflictDialog.close();pendingConflict=null;setDirty(true);await saveNow({force:true})}
function resolveLater(){conflictDialog.close();setStatus("冲突尚未处理；自动保存暂停","err")}

loginBtn.addEventListener("click",requestLogin);
logoutBtn.addEventListener("click",()=>{if(accessToken&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(accessToken);clearAuth("已登出")});
openBtn.addEventListener("click",openCurrentFile);syncBtn.addEventListener("click",syncCheck);
fileIdEl.addEventListener("change",()=>{saveFileId();baseVersion=null;baseContent="";setDirty(false);if(accessTokenValid())openCurrentFile()});
editor.addEventListener("input",()=>{renderPreview();if(conflictActive)return;setDirty(editor.value!==baseContent);if(localDirty)scheduleAutosave()});
preview.addEventListener("input",e=>{if(e.target?.dataset?.stateKey==="progress")$("uiStateProgressValue").textContent=`${e.target.value}%`});
preview.addEventListener("change",e=>{
 const el=e.target,key=el?.dataset?.stateKey;if(!key)return;
 let value=el.value;if(el.type==="checkbox")value=el.checked;if(el.type==="range")value=Number(el.value);writeUiState({[key]:value})
});
$("cloudBtn").addEventListener("click",resolveUseCloud);$("localBtn").addEventListener("click",resolveKeepLocal);$("laterBtn").addEventListener("click",resolveLater);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)syncCheck()});window.addEventListener("focus",syncCheck);
window.addEventListener("online",()=>{setStatus("网络恢复，检查同步…","sync");syncCheck()});window.addEventListener("offline",()=>setStatus("目前离线；修改会留在本机，联网后再同步","err"));
window.addEventListener("DOMContentLoaded",async()=>{fileIdEl.value=localStorage.getItem("driveMemoFileId")||"";renderPreview();if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(console.warn);const restored=restoreSession();try{await initAuth();if(restored){setStatus("已恢复当前浏览器会话","ok");if(getFileId())await openCurrentFile()}}catch(e){setStatus(e.message,"err")}})
