(function(global){
"use strict";

const $=id=>document.getElementById(id),cfg=global.APP_CONFIG||{},Content=global.DriveMemoContent;
const loginBtn=$("loginBtn"),logoutBtn=$("logoutBtn"),openBtn=$("openBtn"),syncBtn=$("syncBtn"),fileIdEl=$("fileId"),editor=$("editor"),preview=$("preview"),statusText=$("statusText"),stateDot=$("stateDot"),fileMeta=$("fileMeta"),dirtyState=$("dirtyState"),identity=$("identity"),conflictDialog=$("conflictDialog"),diffView=$("diffView"),localConflict=$("localConflict"),cloudConflict=$("cloudConflict");

function escapeHtml(text){return String(text||"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]))}
function setStatus(text,kind=""){statusText.textContent=text;stateDot.className=`dot ${kind}`}
function setDirtyIndicator(value){dirtyState.textContent=value?"● 本機有未同步修改":""}
function setConnectedUI(connected){loginBtn.disabled=connected;logoutBtn.disabled=!connected;openBtn.disabled=!connected;syncBtn.disabled=!connected}
function updateMetaView(meta){const modified=meta.modifiedTime?new Date(meta.modifiedTime).toLocaleString():"";fileMeta.textContent=meta.name?`${meta.name}${modified?" · "+modified:""}`:""}

function debugPanelHtml(state){
 const updated=state.updatedAt?` · ${escapeHtml(new Date(state.updatedAt).toLocaleString())}`:"";
 return `<section class="state-lab" aria-label="跨裝置狀態測試">
  <div class="state-lab-head"><div><h4>跨裝置狀態測試</h4><p class="muted">操作後會自動儲存到同一份 Drive 文件${updated}</p></div><span class="state-sync-badge">共 6 種控制項</span></div>
  <div class="state-grid">
   <div class="state-field"><span class="state-label">1. Checkbox</span><div class="state-check"><input id="uiStateChecked" data-state-key="checked" type="checkbox" ${state.checked?"checked":""}><label for="uiStateChecked">這件事已完成</label></div></div>
   <div class="state-field"><span class="state-label">2. 切換開關</span><label class="state-switch"><input data-state-key="switchOn" type="checkbox" ${state.switchOn?"checked":""}><span class="state-switch-track" aria-hidden="true"></span><span>${state.switchOn?"已開啟":"已關閉"}</span></label></div>
   <fieldset class="state-field" style="margin:0"><legend class="state-label">3. 單選狀態</legend><div class="state-options"><input id="priorityLow" data-state-key="priority" type="radio" name="uiPriority" value="low" ${state.priority==="low"?"checked":""}><label for="priorityLow">低</label><input id="priorityNormal" data-state-key="priority" type="radio" name="uiPriority" value="normal" ${state.priority==="normal"?"checked":""}><label for="priorityNormal">普通</label><input id="priorityHigh" data-state-key="priority" type="radio" name="uiPriority" value="high" ${state.priority==="high"?"checked":""}><label for="priorityHigh">高</label></div></fieldset>
   <div class="state-field"><label for="uiStateStage">4. 下拉階段</label><select id="uiStateStage" data-state-key="stage"><option value="todo" ${state.stage==="todo"?"selected":""}>待處理</option><option value="doing" ${state.stage==="doing"?"selected":""}>進行中</option><option value="waiting" ${state.stage==="waiting"?"selected":""}>等待中</option><option value="done" ${state.stage==="done"?"selected":""}>已完成</option></select></div>
   <div class="state-field"><label for="uiStateProgress">5. 數值滑桿</label><div class="state-range"><input id="uiStateProgress" data-state-key="progress" type="range" min="0" max="100" step="5" value="${state.progress}"><output id="uiStateProgressValue">${state.progress}%</output></div></div>
   <div class="state-field"><label for="uiStateNote">6. 短文字狀態</label><input id="uiStateNote" data-state-key="note" type="text" maxlength="80" value="${escapeHtml(state.note)}" placeholder="例如：等 Shawn 確認"></div>
  </div>
 </section>`
}

function renderPreview(){
 const viewModel=Content.toViewModel(editor.value),mainItem=viewModel.categories[0]?.items[0],markdown=mainItem?.content||"";
 preview.innerHTML=debugPanelHtml(viewModel.debugState)+(global.marked?global.marked.parse(markdown):`<pre>${escapeHtml(markdown)}</pre>`)
}

function buildDiffHtml(localText,cloudText){
 if(global.Diff?.diffLines)return global.Diff.diffLines(localText,cloudText).map(part=>{const className=part.added?"diff-add":part.removed?"diff-del":"diff-same",prefix=part.added?"+ ":part.removed?"- ":"  ";return `<div class="${className}">${prefix}${escapeHtml(part.value)}</div>`}).join("");
 return "<div>差異套件未載入；請比較下方本機與雲端版本。</div>"
}

function showConflict(data){
 localConflict.textContent=data.localContent;cloudConflict.textContent=data.cloudContent;diffView.innerHTML=buildDiffHtml(data.localContent,data.cloudContent);if(!conflictDialog.open)conflictDialog.showModal()
}
function closeConflict(){if(conflictDialog.open)conflictDialog.close()}

const sync=global.DriveMemoSync.create({
 config:cfg,
 getFileId:()=>fileIdEl.value,
 getLocalContent:()=>editor.value,
 getIdentity:()=>identity.textContent,
 applyContent:content=>{editor.value=content;renderPreview()},
 onStatus:setStatus,
 onDirty:setDirtyIndicator,
 onMeta:updateMetaView,
 onIdentity:value=>{identity.textContent=value},
 onConnected:setConnectedUI,
 onConflict:showConflict,
 onConflictResolved:closeConflict
});

function writeDebugState(patch){editor.value=Content.updateDebugState(editor.value,patch);renderPreview();sync.localContentChanged()}

loginBtn.addEventListener("click",sync.requestLogin);
logoutBtn.addEventListener("click",sync.logout);
openBtn.addEventListener("click",sync.openCurrentFile);
syncBtn.addEventListener("click",sync.syncCheck);
fileIdEl.addEventListener("change",sync.fileIdChanged);
editor.addEventListener("input",()=>{renderPreview();sync.localContentChanged()});
preview.addEventListener("input",event=>{if(event.target?.dataset?.stateKey==="progress")$("uiStateProgressValue").textContent=`${event.target.value}%`});
preview.addEventListener("change",event=>{const element=event.target,key=element?.dataset?.stateKey;if(!key)return;let value=element.value;if(element.type==="checkbox")value=element.checked;if(element.type==="range")value=Number(element.value);writeDebugState({[key]:value})});
$("cloudBtn").addEventListener("click",sync.resolveUseCloud);
$("localBtn").addEventListener("click",sync.resolveKeepLocal);
$("laterBtn").addEventListener("click",()=>{closeConflict();sync.resolveLater()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)sync.syncCheck()});
global.addEventListener("focus",sync.syncCheck);
global.addEventListener("online",()=>{sync.reportStatus("網路已恢復，檢查同步…","sync");sync.syncCheck()});
global.addEventListener("offline",()=>sync.reportStatus("目前離線；修改會留在本機，連線後再同步","err"));
async function initializeUi(){fileIdEl.value=localStorage.getItem("driveMemoFileId")||"";renderPreview();if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(console.warn);try{await sync.initialize()}catch(error){setStatus(error.message,"err")}}
if(document.readyState==="loading")global.addEventListener("DOMContentLoaded",initializeUi);else initializeUi();

global.DriveMemoUI=Object.freeze({renderPreview,sync});
})(window);
