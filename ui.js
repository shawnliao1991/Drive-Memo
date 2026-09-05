(function(global){
"use strict";

const Content=global.DriveMemoContent;
const byId=id=>document.getElementById(id);
const els={
 journalNav:byId("journalNav"),debugNav:byId("debugNav"),journalPage:byId("journalPage"),debugPage:byId("debugPage"),
 loginBtn:byId("loginBtn"),logoutBtn:byId("logoutBtn"),openBtn:byId("openBtn"),syncBtn:byId("syncBtn"),
 fileId:byId("fileId"),editor:byId("editor"),preview:byId("preview"),statusText:byId("statusText"),stateDot:byId("stateDot"),
 fileMeta:byId("fileMeta"),dirtyState:byId("dirtyState"),identity:byId("identity"),selectedDateLabel:byId("selectedDateLabel"),selectedDateSub:byId("selectedDateSub"),
 prevDateBtn:byId("prevDateBtn"),nextDateBtn:byId("nextDateBtn"),todayBtn:byId("todayBtn"),addBulletBtn:byId("addBulletBtn"),
 nowList:byId("nowList"),nextList:byId("nextList"),doneList:byId("doneList"),nowCount:byId("nowCount"),nextCount:byId("nextCount"),doneCount:byId("doneCount"),
 timeline:byId("timeline"),rolloverPanel:byId("rolloverPanel"),rolloverSummary:byId("rolloverSummary"),rolloverList:byId("rolloverList"),
 rolloverSelectedBtn:byId("rolloverSelectedBtn"),rolloverAllBtn:byId("rolloverAllBtn"),bulletDialog:byId("bulletDialog"),bulletForm:byId("bulletForm"),
 bulletDialogTitle:byId("bulletDialogTitle"),bulletId:byId("bulletId"),bulletTitle:byId("bulletTitle"),bulletAction:byId("bulletAction"),bulletDate:byId("bulletDate"),
 bulletPriority:byId("bulletPriority"),bulletDetails:byId("bulletDetails"),bulletHistoryField:byId("bulletHistoryField"),bulletHistory:byId("bulletHistory"),deleteBulletBtn:byId("deleteBulletBtn"),cancelBulletBtn:byId("cancelBulletBtn"),
 toast:byId("toast"),toastText:byId("toastText"),undoDeleteBtn:byId("undoDeleteBtn"),conflictDialog:byId("conflictDialog"),diffView:byId("diffView"),
 localConflict:byId("localConflict"),cloudConflict:byId("cloudConflict"),laterBtn:byId("laterBtn"),cloudBtn:byId("cloudBtn"),localBtn:byId("localBtn")
};

const priorityNames={urgent:"立即處理",today:"今天完成",soon:"這幾天",someday:"慢慢做"};
let selectedDate=Content.localDateKey(),lastDeletedId=null,toastTimer=null,identityValue="";

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char])}
function formatDate(dateKey,withYear=false){const[y,m,d]=dateKey.split("-").map(Number),date=new Date(y,m-1,d,12),weekday=new Intl.DateTimeFormat("zh-TW",{weekday:"short"}).format(date);return withYear?`${y} 年 ${m} 月 ${d} 日 ${weekday}`:`${m} 月 ${d} 日 ${weekday}`}
function emptyMessage(text){return`<div class="empty">${escapeHtml(text)}</div>`}

function renderBullet(bullet,{timeline=false}={}){
 const done=bullet.status==="done",migrated=bullet.status==="migrated",resolved=migrated&&bullet.chainResolved;
 const classes=["bullet",bullet.priority,done?"done":"",resolved?"resolved":""].filter(Boolean).join(" ");
 const status=migrated?`<span class="migrated-tag">${resolved?"已完成":"已順延"}</span>`:`<button class="status-btn ${done?"checked":""}" data-action="toggle" data-id="${escapeHtml(bullet.id)}" aria-label="${done?"標示為未完成":"標示為完成"}">${done?"✓":""}</button>`;
 return`<article class="${classes}" data-id="${escapeHtml(bullet.id)}">${status}<button class="bullet-main" data-action="open" data-id="${escapeHtml(bullet.id)}"><span class="bullet-title">${escapeHtml(bullet.title)}</span><span class="bullet-action">${escapeHtml(bullet.action||"尚未填寫 Action")}</span></button>${timeline&&migrated?"":`<span class="priority-label">${priorityNames[bullet.priority]}</span>`}</article>`
}

function renderList(element,bullets,emptyText){element.innerHTML=bullets.length?bullets.map(bullet=>renderBullet(bullet)).join(""):emptyMessage(emptyText)}

function renderRollover(candidates){
 const visible=selectedDate===Content.localDateKey()&&candidates.length>0;
 els.rolloverPanel.classList.toggle("hidden",!visible);
 if(!visible)return;
 els.rolloverSummary.textContent=`共有 ${candidates.length} 件之前未完成的事，可建立今天的新 Bullet。`;
 els.rolloverList.innerHTML=candidates.map(bullet=>`<label class="rollover-row"><input type="checkbox" value="${escapeHtml(bullet.id)}" checked><span><strong>${escapeHtml(bullet.title)}</strong><span class="bullet-action">${escapeHtml(bullet.action)}</span></span><small class="muted">${escapeHtml(bullet.date)}</small></label>`).join("");
}

function renderTimeline(days){
 if(!days.length){els.timeline.innerHTML=emptyMessage("完成或順延後，這裡會留下每天的軌跡。");return}
 els.timeline.innerHTML=days.map(day=>`<details class="day" ${day.date===selectedDate?"open":""}><summary>${escapeHtml(formatDate(day.date,true))} · ${day.bullets.length}</summary><div class="day-items">${day.bullets.map(bullet=>renderBullet(bullet,{timeline:true})).join("")}</div></details>`).join("");
}

function renderJournal(){
 const view=Content.getViewModel(els.editor.value,selectedDate),today=Content.localDateKey();
 els.selectedDateLabel.textContent=formatDate(selectedDate,true);
 els.selectedDateSub.textContent=selectedDate===today?"今天":selectedDate<today?"過去":"未來";
 els.todayBtn.disabled=selectedDate===today;
 renderList(els.nowList,view.now,"這一天沒有需要立刻處理的事。");
 renderList(els.nextList,view.next,"這一天暫時沒有排在後面的事。");
 renderList(els.doneList,view.done,"完成一件事後，會收進這裡。");
 els.nowCount.textContent=view.now.length;els.nextCount.textContent=view.next.length;els.doneCount.textContent=view.done.length;
 renderRollover(view.carryCandidates);renderTimeline(view.timeline);
}

function renderDebug(){
 const view=Content.toViewModel(els.editor.value),state=view.debugState,legacy=view.categories[0].items[0].content;
 const markdown=global.marked?.parse?global.marked.parse(legacy):`<pre>${escapeHtml(legacy)}</pre>`;
 els.preview.innerHTML=`<section class="state-lab"><div class="state-lab-head"><div><h4>跨裝置狀態測試</h4><span class="muted">每次操作都會寫進同一份 Drive 文件</span></div><span class="state-sync-badge">文件內狀態</span></div><div class="state-grid"><div class="state-field"><span class="state-label">Checkbox</span><label class="state-check"><input data-debug="checked" type="checkbox" ${state.checked?"checked":""}> 已確認</label></div><div class="state-field"><span class="state-label">Switch</span><label class="state-switch"><input data-debug="switchOn" type="checkbox" ${state.switchOn?"checked":""}><span class="state-switch-track"></span><span>${state.switchOn?"開":"關"}</span></label></div><div class="state-field"><span class="state-label">重要度</span><div class="state-options">${["low","normal","high"].map(value=>`<input id="priority-${value}" data-debug="priority" type="radio" name="priority" value="${value}" ${state.priority===value?"checked":""}><label for="priority-${value}">${{low:"低",normal:"中",high:"高"}[value]}</label>`).join("")}</div></div><div class="state-field"><label for="debug-stage">階段</label><select id="debug-stage" data-debug="stage">${[["todo","待辦"],["doing","進行中"],["waiting","等待"],["done","完成"]].map(([value,label])=>`<option value="${value}" ${state.stage===value?"selected":""}>${label}</option>`).join("")}</select></div><div class="state-field"><span class="state-label">進度</span><div class="state-range"><input data-debug="progress" type="range" min="0" max="100" value="${state.progress}"><output>${state.progress}%</output></div></div><div class="state-field"><label for="debug-note">短文字</label><input id="debug-note" data-debug="note" type="text" maxlength="80" value="${escapeHtml(state.note)}" placeholder="跨裝置同步內容"></div></div></section>${markdown}`;
}

function renderAll(){renderJournal();renderDebug()}
function backupLegacyOnce(){const parsed=Content.parse(els.editor.value);if(parsed.hasJournal)return;try{const scope=(els.fileId.value.trim()||"local").replace(/[^a-zA-Z0-9_-]/g,"_");localStorage.setItem(`driveMemoV1Backup:${scope}:${Date.now()}`,els.editor.value)}catch{}}
function mutateContent(producer,{journal=true}={}){if(journal)backupLegacyOnce();const next=producer(els.editor.value);if(typeof next!=="string"||next===els.editor.value)return;els.editor.value=next;renderAll();sync.localContentChanged()}

function openBulletDialog(id=""){
 const bullet=id?Content.getBullet(els.editor.value,id):null;
 const history=bullet?Content.getItemHistory(els.editor.value,id):[];
 els.bulletDialogTitle.textContent=bullet?"編輯 Bullet":"新增 Bullet";els.bulletId.value=bullet?.id||"";els.bulletTitle.value=bullet?.title||"";els.bulletAction.value=bullet?.action||"";els.bulletDate.value=bullet?.date||selectedDate;els.bulletPriority.value=bullet?.priority||"someday";els.bulletDetails.value=bullet?.details||"";els.deleteBulletBtn.classList.toggle("hidden",!bullet);els.bulletHistoryField.classList.toggle("hidden",!bullet);els.bulletHistory.innerHTML=history.map(entry=>`<div class="history-row"><time>${escapeHtml(entry.date)}</time><span class="history-action">${escapeHtml(entry.action)}</span><span class="history-state">${entry.status==="done"?"已完成":entry.status==="migrated"?"已順延":"未完成"}</span></div>`).join("");els.bulletDialog.showModal();setTimeout(()=>els.bulletTitle.focus(),0)
}
function closeBulletDialog(){els.bulletDialog.close()}
function showToast(text,id){lastDeletedId=id;els.toastText.textContent=text;els.toast.classList.remove("hidden");clearTimeout(toastTimer);toastTimer=setTimeout(()=>{els.toast.classList.add("hidden");lastDeletedId=null},6000)}

function handleJournalClick(event){
 const target=event.target.closest("[data-action]");if(!target)return;const id=target.dataset.id;
 if(target.dataset.action==="open")openBulletDialog(id);
 if(target.dataset.action==="toggle"){const bullet=Content.getBullet(els.editor.value,id);if(bullet)mutateContent(markdown=>Content.setBulletStatus(markdown,id,bullet.status==="done"?"todo":"done"))}
}

function carrySelected(all=false){const ids=all?[...els.rolloverList.querySelectorAll("input")].map(input=>input.value):[...els.rolloverList.querySelectorAll("input:checked")].map(input=>input.value);if(!ids.length){sync.reportStatus("請先勾選要順延的項目","");return}mutateContent(markdown=>Content.carryForward(markdown,ids,Content.localDateKey()))}

function route(){const debug=location.hash==="#sync-debug";els.journalPage.classList.toggle("hidden",debug);els.debugPage.classList.toggle("hidden",!debug);els.journalNav.classList.toggle("active",!debug);els.debugNav.classList.toggle("active",debug)}
function setStatus(text,kind=""){els.statusText.textContent=text;els.stateDot.className=`dot ${kind}`.trim()}
function setConnected(connected){els.loginBtn.disabled=connected;els.logoutBtn.disabled=!connected;els.openBtn.disabled=!connected;els.syncBtn.disabled=!connected}
function setIdentity(value){identityValue=value;els.identity.textContent=value}
function setMeta(meta){els.fileMeta.textContent=meta?.name?`${meta.name} · v${meta.version||"?"}`:""}
function setDirty(dirty){els.dirtyState.textContent=dirty?"有尚未同步的修改":""}

function diffSummary(local,cloud){
 if(!global.Diff?.diffLines)return"本機與雲端內容不同，請選擇保留哪一版。";
 return global.Diff.diffLines(cloud,local).slice(0,80).map(part=>`<div class="${part.added?"diff-add":part.removed?"diff-del":"diff-same"}">${escapeHtml(part.value)}</div>`).join("")
}
function showConflict(data){els.diffView.innerHTML=diffSummary(data.localContent,data.cloudContent);els.localConflict.textContent=data.localContent;els.cloudConflict.textContent=data.cloudContent;els.conflictDialog.showModal()}
function closeConflict(){if(els.conflictDialog.open)els.conflictDialog.close()}

const sync=global.DriveMemoSync.create({
 config:global.APP_CONFIG||{},getFileId:()=>els.fileId.value,getLocalContent:()=>els.editor.value,getIdentity:()=>identityValue,
 applyContent:content=>{els.editor.value=content;renderAll()},onStatus:setStatus,onDirty:setDirty,onMeta:setMeta,onIdentity:setIdentity,onConnected:setConnected,onConflict:showConflict,onConflictResolved:closeConflict
});

function bindEvents(){
 addEventListener("hashchange",route);els.prevDateBtn.addEventListener("click",()=>{selectedDate=Content.shiftDate(selectedDate,-1);renderJournal()});els.nextDateBtn.addEventListener("click",()=>{selectedDate=Content.shiftDate(selectedDate,1);renderJournal()});els.todayBtn.addEventListener("click",()=>{selectedDate=Content.localDateKey();renderJournal()});
 els.addBulletBtn.addEventListener("click",()=>openBulletDialog());els.journalPage.addEventListener("click",handleJournalClick);els.rolloverSelectedBtn.addEventListener("click",()=>carrySelected(false));els.rolloverAllBtn.addEventListener("click",()=>carrySelected(true));
 els.cancelBulletBtn.addEventListener("click",closeBulletDialog);els.bulletForm.addEventListener("submit",event=>{event.preventDefault();const data={title:els.bulletTitle.value.trim(),action:els.bulletAction.value.trim(),date:els.bulletDate.value,priority:els.bulletPriority.value,details:els.bulletDetails.value.trim()};if(!data.title||!data.action)return;const id=els.bulletId.value;mutateContent(markdown=>id?Content.updateBullet(markdown,id,data):Content.addBullet(markdown,data).markdown);closeBulletDialog()});
 els.deleteBulletBtn.addEventListener("click",()=>{const id=els.bulletId.value,title=els.bulletTitle.value.trim()||"Bullet";if(!id)return;mutateContent(markdown=>Content.softDeleteBullet(markdown,id));closeBulletDialog();showToast(`已刪除「${title}」`,id)});els.undoDeleteBtn.addEventListener("click",()=>{if(!lastDeletedId)return;mutateContent(markdown=>Content.restoreBullet(markdown,lastDeletedId));lastDeletedId=null;els.toast.classList.add("hidden")});
 els.preview.addEventListener("change",event=>{const key=event.target.dataset.debug;if(!key)return;let value=event.target.value;if(event.target.type==="checkbox")value=event.target.checked;if(event.target.type==="range")value=Number(value);mutateContent(markdown=>Content.updateDebugState(markdown,{[key]:value}),{journal:false})});els.preview.addEventListener("input",event=>{if(event.target.dataset.debug==="progress")event.target.nextElementSibling.value=`${event.target.value}%`});
 els.editor.addEventListener("input",()=>{renderAll();sync.localContentChanged()});els.fileId.addEventListener("change",()=>sync.fileIdChanged());els.loginBtn.addEventListener("click",()=>sync.requestLogin());els.logoutBtn.addEventListener("click",()=>sync.logout());els.openBtn.addEventListener("click",()=>sync.openCurrentFile());els.syncBtn.addEventListener("click",()=>sync.syncCheck());
 els.laterBtn.addEventListener("click",()=>{sync.resolveLater();closeConflict()});els.cloudBtn.addEventListener("click",()=>sync.resolveUseCloud());els.localBtn.addEventListener("click",()=>sync.resolveKeepLocal());
}

function initialize(){els.fileId.value=localStorage.getItem("driveMemoFileId")||"";bindEvents();route();renderAll();sync.initialize().catch(error=>setStatus(`初始化失敗：${error.message}`,"err"));if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{})}

initialize();
global.DriveMemoUI=Object.freeze({renderAll,sync});
})(window);
