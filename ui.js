(function(global){
"use strict";

const Content=global.DriveMemoContent;
const byId=id=>document.getElementById(id);
const els={
 journalNav:byId("journalNav"),notesNav:byId("notesNav"),passwordsNav:byId("passwordsNav"),contactsNav:byId("contactsNav"),smallCardsNav:byId("smallCardsNav"),debugNav:byId("debugNav"),journalPage:byId("journalPage"),notesPage:byId("notesPage"),passwordsPage:byId("passwordsPage"),contactsPage:byId("contactsPage"),smallCardsPage:byId("smallCardsPage"),debugPage:byId("debugPage"),
 loginBtn:byId("loginBtn"),openBtn:byId("openBtn"),syncBtn:byId("syncBtn"),
 fileId:byId("fileId"),editor:byId("editor"),statusText:byId("statusText"),stateDot:byId("stateDot"),
 fileMeta:byId("fileMeta"),dirtyState:byId("dirtyState"),identity:byId("identity"),addBulletBtn:byId("addBulletBtn"),agenda:byId("agenda"),
 rolloverPanel:byId("rolloverPanel"),rolloverSummary:byId("rolloverSummary"),rolloverList:byId("rolloverList"),
 rolloverSelectedBtn:byId("rolloverSelectedBtn"),bulletDialog:byId("bulletDialog"),bulletForm:byId("bulletForm"),
 bulletDialogTitle:byId("bulletDialogTitle"),bulletId:byId("bulletId"),bulletMode:byId("bulletMode"),actionField:byId("actionField"),actionDateField:byId("actionDateField"),actionPriorityField:byId("actionPriorityField"),bulletAction:byId("bulletAction"),bulletDate:byId("bulletDate"),bulletDateButton:byId("bulletDateButton"),datePicker:byId("datePicker"),calendarTitle:byId("calendarTitle"),calendarGrid:byId("calendarGrid"),
 bulletPriority:byId("bulletPriority"),priorityPicker:byId("priorityPicker"),actionRowsEditor:byId("actionRowsEditor"),bulletHistoryField:byId("bulletHistoryField"),bulletHistory:byId("bulletHistory"),cancelBulletBtn:byId("cancelBulletBtn"),
 toast:byId("toast"),toastText:byId("toastText"),undoDeleteBtn:byId("undoDeleteBtn"),conflictDialog:byId("conflictDialog"),diffView:byId("diffView"),
 localConflict:byId("localConflict"),cloudConflict:byId("cloudConflict"),laterBtn:byId("laterBtn"),cloudBtn:byId("cloudBtn"),localBtn:byId("localBtn"),imageHover:byId("imageHover"),imageDialog:byId("imageDialog"),imageDialogTitle:byId("imageDialogTitle"),imageDialogImg:byId("imageDialogImg"),closeImageBtn:byId("closeImageBtn")
};

const priorityNames={urgent:"立即處理",today:"今天完成",soon:"這幾天",someday:"普通"},ACTION_FALLBACK="Unnamed action！",RICH_DETAILS_MARKER="<!-- DRIVE_MEMO_RICH_DETAILS_V1 -->";
let agendaRange="week";let selectedDate=Content.localDateKey(),calendarMonth="",lastDeletedId=null,toastTimer=null,identityValue="",activeImageLink=null;
const imageUrlCache=new Map();

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char])}
function agendaDateParts(dateKey){const[,month,day]=dateKey.split("-").map(Number),weekday="日一二三四五六"[new Date(`${dateKey}T12:00:00`).getDay()],today=Content.localDateKey(),relative=dateKey===today?"今天":dateKey===Content.shiftDate(today,1)?"明天":dateKey===Content.shiftDate(today,2)?"後天":dateKey===Content.shiftDate(today,7)?"一週後":"";return{label:`${month}月${day}日`,weekday,relative,weekend:weekday==="六"||weekday==="日"}}
function emptyMessage(text){return`<div class="empty">${escapeHtml(text)}</div>`}
function formatDateLabel(dateKey){if(!/^\d{4}-\d{2}-\d{2}$/.test(dateKey||""))return"選擇日期";const[year,month,day]=dateKey.split("-").map(Number),weekday="日一二三四五六"[new Date(year,month-1,day,12).getDay()];return`${year}年${month}月${day}日（${weekday}）`}
function setPriority(priority){els.bulletDialog.dataset.pending="false";const value=Content.PRIORITIES.includes(priority)?priority:"someday";els.bulletPriority.value=value;els.priorityPicker.querySelectorAll("[data-priority]").forEach(button=>{const active=button.dataset.priority===value;button.classList.toggle("active",active);button.setAttribute("aria-checked",String(active))})}
function setBulletDate(dateKey){const value=/^\d{4}-\d{2}-\d{2}$/.test(dateKey||"")?dateKey:Content.localDateKey();els.bulletDate.value=value;els.bulletDateButton.textContent=value.slice(5).replace("-","/");els.bulletDateButton.setAttribute("aria-label",formatDateLabel(value))}
function renderDatePicker(){const selected=els.bulletDate.value||Content.localDateKey(),monthKey=/^\d{4}-\d{2}$/.test(calendarMonth)?calendarMonth:selected.slice(0,7),[year,month]=monthKey.split("-").map(Number),firstDay=new Date(year,month-1,1,12).getDay(),daysInMonth=new Date(year,month,0,12).getDate(),today=Content.localDateKey(),cells=[];calendarMonth=`${year}-${String(month).padStart(2,"0")}`;els.calendarTitle.textContent=`${year}年${month}月`;for(let index=0;index<firstDay;index++)cells.push('<span class="calendar-blank"></span>');for(let day=1;day<=daysInMonth;day++){const dateKey=`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`,weekday=new Date(year,month-1,day,12).getDay(),classes=["calendar-day",weekday===0||weekday===6?"weekend":"",dateKey===today?"today-date":"",dateKey===selected?"selected":""].filter(Boolean).join(" ");cells.push(`<button type="button" class="${classes}" data-calendar="select" data-date="${dateKey}" aria-label="${formatDateLabel(dateKey)}" ${dateKey===selected?'aria-current="date"':""}>${day}</button>`)}els.calendarGrid.innerHTML=cells.join("")}
function toggleDatePicker(force){const open=force===undefined?els.datePicker.classList.contains("hidden"):force;els.datePicker.classList.toggle("hidden",!open);els.bulletDateButton.setAttribute("aria-expanded",String(open));if(open){calendarMonth=(els.bulletDate.value||Content.localDateKey()).slice(0,7);renderDatePicker()}}
function shiftCalendarMonth(delta){const[year,month]=calendarMonth.split("-").map(Number),date=new Date(year,month-1+delta,1,12);calendarMonth=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;renderDatePicker()}
function driveImageId(url){const value=String(url||"");return value.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i)?.[1]||value.match(/[?&]id=([^&#]+)/i)?.[1]||""}
function sanitizeRichHtml(value){const template=document.createElement("template"),allowed=new Set(["A","B","BR","DETAILS","DIV","EM","FONT","I","LI","OL","P","SPAN","STRONG","SUMMARY","U","UL"]);template.innerHTML=String(value||"");template.content.querySelectorAll("script,style,iframe,object,embed,form,input,button,textarea,select,svg,math").forEach(element=>element.remove());[...template.content.querySelectorAll("*")].forEach(element=>{if(!allowed.has(element.tagName)){element.replaceWith(...element.childNodes);return}[...element.attributes].forEach(attribute=>{const name=attribute.name.toLowerCase(),tag=element.tagName;if(name==="open"&&tag==="DETAILS")return;if(name==="href"&&tag==="A"&&/^https?:\/\//i.test(attribute.value))return;if(name==="size"&&tag==="FONT"&&/^[1-7]$/.test(attribute.value))return;if(name==="color"&&tag==="FONT"&&/^#[0-9a-f]{6}$/i.test(attribute.value))return;if(name==="class"&&["outline-body","outline-children"].includes(attribute.value))return;if(name==="style"){const styles=[];for(const prop of ["color","font-size","font-weight"]){const v=element.style.getPropertyValue(prop);if(v&&/^(#[0-9a-f]{3,8}|rgb\([\d\s,.%]+\)|[\d.]+(?:px|em|rem|%)?|bold|normal)$/i.test(v))styles.push(`${prop}:${v}`)}element.setAttribute("style",styles.join(";"));return;}element.removeAttribute(attribute.name)});if(element.tagName==="A"&&!/^https?:\/\//i.test(element.getAttribute("href")||""))element.replaceWith(document.createTextNode(element.textContent||""))});return template.innerHTML}
function decorateProjectLinks(container){container.querySelectorAll("a").forEach(link=>{const href=link.getAttribute("href")||"";link.target="_blank";link.rel="noopener noreferrer";const fileId=driveImageId(href);if(fileId||/\.(png|jpe?g|gif|webp|avif)(?:[?#]|$)/i.test(href)){link.classList.add("project-image-link");link.textContent="【Pic】";link.dataset.fileId=fileId;link.removeAttribute("title")}})}
function renderProjectDetails(value){const raw=String(value||"").trim();if(!raw)return"";const rich=raw.startsWith(RICH_DETAILS_MARKER),source=rich?raw.slice(RICH_DETAILS_MARKER.length):global.marked?.parse?global.marked.parse(escapeHtml(raw),{breaks:true}):`<p>${escapeHtml(raw).replace(/\n/g,"<br>")}</p>`,template=document.createElement("template");template.innerHTML=sanitizeRichHtml(source);decorateProjectLinks(template.content);return template.innerHTML}
const actionDraft={page:{id:"",rows:[]},change(fn){fn(this.page);queueEdit()},drivePreview(url){
 const id=/^https:\/\/drive\.google\.com\//i.test(url)&&driveImageId(url);return id?getDriveImageUrl(id):null;
}};
const actionEditor=global.DriveMemoNotes.create(els.actionRowsEditor,()=>Content.parse(els.editor.value),null,openBulletDialog,()=>els.fileId.value,actionDraft);
let originalDetails="",originalRows="";
function loadProjectDetailsEditor(value){
 originalDetails=value||"";
 const template=document.createElement("template"),rows=[];
 template.innerHTML=value?.startsWith(RICH_DETAILS_MARKER)?value.slice(RICH_DETAILS_MARKER.length):renderProjectDetails(value);
 function visit(parent,depth){
  let text="";
  function flush(){if(text.length)rows.push({type:"text",text,depth});text=""}
  function walk(n){
   if(n.nodeType===3){text+=n.textContent;return}
   if(n.nodeType!==1||n.matches("script,style"))return;
   if(n.hasAttribute("data-note-row")){
    flush();const type=n.dataset.noteRow,link=n.querySelector("a");
    rows.push({type,text:link?.getAttribute("href")??n.textContent,depth:Math.max(0,Number(n.dataset.depth)||0),...(n.hasAttribute("data-folded")?{collapsed:true}:{})});return;
   }
   if(n.matches("br")){flush();return}
   if(n.matches("a[href],img[src]")){flush();const url=n.getAttribute("href")||n.getAttribute("src");rows.push({type:n.matches("img")||driveImageId(url)||/\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(url)?"image":"link",text:url,depth});return}
   if(n.matches("details,div,p,li,ul,ol,summary")){
    flush();const first=rows.length;visit(n,depth+(n.matches(".outline-children")||n.matches("li>ul,li>ol")?1:0));
    if(n.matches("summary")&&rows.length===first)rows.push({type:"text",text:"",depth});
    if(n.matches("details:not([open])")&&rows[first])rows[first].collapsed=true;return
   }
   for(const child of n.childNodes)walk(child);
  }
  for(const n of parent.childNodes)walk(n);flush();
 }
 visit(template.content,0);originalRows=JSON.stringify(rows);
 actionDraft.page={id:crypto.randomUUID(),rows};actionEditor.reset();
}
function serializeProjectDetails(){
 const rows=actionDraft.page.rows;if(JSON.stringify(rows)===originalRows)return originalDetails;
 if(!rows.length)return "";
 return RICH_DETAILS_MARKER+rows.map(r=>{
  const value=escapeHtml(r.text),content=["image","link"].includes(r.type)?'<a href="'+value+'">'+(r.type==="image"?"圖片":value)+'</a>':value;
  return '<div data-note-row="'+escapeHtml(r.type)+'" data-depth="'+r.depth+'"'+(r.collapsed?' data-folded=""':'')+'>'+content+'</div>';
 }).join("");
}
async function getDriveImageUrl(fileId){if(imageUrlCache.has(fileId))return imageUrlCache.get(fileId);const blob=await sync.fetchDriveImage(fileId),url=URL.createObjectURL(blob);imageUrlCache.set(fileId,url);return url}
let hoverPoint={x:0,y:0};
function positionImageHover(){const width=Math.min(innerWidth-16,innerWidth*.7),height=innerHeight*.7;els.imageHover.style.left=Math.max(8,Math.min(innerWidth-width-8,hoverPoint.x+16))+"px";els.imageHover.style.top=Math.max(8,Math.min(innerHeight-height-8,hoverPoint.y+16))+"px"}
async function showImageHover(link,event){activeImageLink=link;hoverPoint={x:event.clientX,y:event.clientY};const parent=link.closest("dialog")||document.body;parent.append(els.imageHover);els.imageHover.innerHTML='<span class="muted">載入中…</span>';els.imageHover.classList.remove("hidden");positionImageHover();try{const url=link.dataset.fileId?await getDriveImageUrl(link.dataset.fileId):link.href;if(activeImageLink!==link)return;const image=document.createElement("img");image.src=url;image.alt="圖片預覽";els.imageHover.replaceChildren(image)}catch(error){if(activeImageLink===link)els.imageHover.innerHTML='<span class="muted">請連接 Google 以載入圖片</span>'}}
function hideImageHover(){activeImageLink=null;els.imageHover.classList.add("hidden")}
async function openProjectImage(link){hideImageHover();try{els.imageDialogTitle.textContent=link.textContent||"圖片預覽";els.imageDialogImg.removeAttribute("src");els.imageDialog.showModal();const url=link.dataset.fileId?await getDriveImageUrl(link.dataset.fileId):link.href;els.imageDialogImg.src=url}catch(error){if(els.imageDialog.open)els.imageDialog.close();sync.reportStatus(error.message==="AUTH_EXPIRED"?"請重新連接 Google 後查看圖片":`圖片載入失敗：${error.message}`,"err")}}

function renderBullet(bullet){
 const done=bullet.status==="done",migrated=bullet.status==="migrated",resolved=migrated&&bullet.chainResolved;
 const selected=els.bulletDialog.open&&els.bulletDialog.classList.contains("docked-action")&&els.bulletId.value===bullet.id;
 const classes=["bullet","general-action",bullet.pending?"pending":bullet.priority,done?"done":"",resolved?"resolved":"",selected?"selected-action":""].filter(Boolean).join(" ");
 const title=bullet.action||ACTION_FALLBACK;
 return`<article class="${classes}" data-id="${escapeHtml(bullet.id)}" data-drag-id="${escapeHtml(bullet.id)}"${selected?' aria-current="true"':""}><button type="button" class="action-drag-handle" draggable="true" aria-label="拖曳移動 Action" title="拖曳移動">⠿</button><button class="bullet-main" data-action="open" data-id="${escapeHtml(bullet.id)}"><span class="bullet-title">${escapeHtml(title)}</span></button>${migrated?`<span class="migrated-tag">${resolved?"已完成":"已順延"}</span>`:`<span class="priority-label">${bullet.pending?"待確認":priorityNames[bullet.priority]}</span>`}</article>`
}

function renderList(bullets,emptyText){return bullets.length?bullets.map(bullet=>renderBullet(bullet)).join(""):emptyMessage(emptyText)}

function renderRollover(candidates){
 const visible=selectedDate===Content.localDateKey()&&candidates.length>0;
 els.rolloverPanel.classList.toggle("hidden",!visible);
 if(!visible)return;

 els.rolloverList.innerHTML=candidates.map(bullet=>`<label class="rollover-row ${escapeHtml(bullet.pending?"pending":bullet.priority)}" data-drag-id="${escapeHtml(bullet.id)}"><button type="button" class="action-drag-handle" draggable="true" aria-label="拖曳移動 Action" title="拖曳移動">⠿</button><input type="checkbox" value="${escapeHtml(bullet.id)}" checked><span class="rollover-copy"><strong>${escapeHtml(bullet.action||ACTION_FALLBACK)}</strong></span><span class="priority-label rollover-priority">${escapeHtml(bullet.pending?"待確認":priorityNames[bullet.priority])}</span></label>`).join("");
}

function renderAgenda(days){
 els.agenda.innerHTML=days.map(day=>{const date=agendaDateParts(day.date),dayClass=[date.relative==="今天"?"today-day":"",date.relative==="明天"?"tomorrow-day":"",date.weekend?"weekend":"",day.dragOnly?"drag-only-day":""].filter(Boolean).join(" "),doneSection=day.done.length?`<details class="agenda-section agenda-done" ${date.relative==="今天"?"open":""}><summary class="agenda-section-head"><h3>Done</h3></summary><div class="bullet-list">${renderList(day.done,"尚未完成項目")}</div></details>`:"";return`<section class="panel agenda-day ${dayClass}" data-date="${day.date}" data-drop-date="${day.date}"><header class="agenda-date"><time datetime="${day.date}"><span>${date.label}</span><span>（${date.weekday}）</span>${date.relative?`<strong>${date.relative}</strong>`:""}</time><button type="button" class="icon-btn day-add" data-action="add-day" data-date="${day.date}" aria-label="${day.date} 新增 Action">＋</button></header><div class="agenda-section"><div class="bullet-list">${renderList(day.todo,date.relative==="今天"?"今天沒有待辦事項。":"這天尚未安排待辦事項。")}</div></div>${doneSection}</section>`}).join("")
}

function renderProjectPreview(value){
 const template=document.createElement("template");template.innerHTML=renderProjectDetails(value);
 template.content.querySelectorAll("li").forEach(li=>{const children=[...li.children].filter(child=>child.matches("ul,ol"));if(!children.length)return;const details=document.createElement("details"),summary=document.createElement("summary");[...li.childNodes].filter(node=>!children.includes(node)).forEach(node=>summary.append(node));details.append(summary,...children);li.append(details)});
 template.content.querySelectorAll("details").forEach(node=>node.open=false);return template.innerHTML
}
function renderProjectActions(actions){return actions.length?'<ul class="project-action-list">'+actions.map(action=>`<li><button type="button" class="project-action-row ${action.status==="done"?"done":""}" data-action="open-project" data-id="${escapeHtml(action.id)}"><time datetime="${action.date}">${escapeHtml(action.date)}</time><span class="action-text"><span class="action-priority ${escapeHtml(action.priority)}"></span>${escapeHtml(action.action||ACTION_FALLBACK)}</span><span class="action-state ${action.status==="todo"?"unfinished-text":""}">${action.status==="done"?"已完成":"未完成"}</span></button></li>`).join("")+'</ul>':'<div class="empty unfinished-text">沒有未完成的 Action</div>'}
function renderTrash(){const deleted=Content.getTrash(els.editor.value);byId("trashCount").textContent=String(deleted.length);byId("trashList").innerHTML=deleted.length?deleted.map(bullet=>`<article class="trash-action-row" data-trash-id="${escapeHtml(bullet.id)}"><div><strong>${escapeHtml(bullet.action||bullet.title||"Unnamed action！")}</strong></div><time datetime="${escapeHtml(bullet.date)}">${escapeHtml(bullet.date)}</time></article>`).join(""):emptyMessage("垃圾桶是空的")}

function renderJournal(){
 selectedDate=Content.localDateKey();const view=Content.getViewModel(els.editor.value,selectedDate),selectedDates=journalTools?.getSelectedDates()||[],visibleDays=selectedDates.length?selectedDates.map(date=>Content.getAgenda(els.editor.value,date,2)[0]):Content.getAgendaRange(els.editor.value,selectedDate,agendaRange),dayMap=new Map(visibleDays.map(day=>[day.date,day]));for(let i=0;i<14;i++){const date=Content.shiftDate(selectedDate,i);if(!dayMap.has(date))dayMap.set(date,{...Content.getAgenda(els.editor.value,date,2)[0],dragOnly:true})}const days=[...dayMap.values()].sort((a,b)=>a.date.localeCompare(b.date));
 renderRollover(selectedDates.length?[]:view.carryCandidates);renderAgenda(days);journalTools?.renderCalendar();document.querySelectorAll("[data-agenda-range]").forEach(n=>n.setAttribute("aria-pressed",String(!selectedDates.length&&n.dataset.agendaRange===agendaRange)));
}



const noteEditor=global.DriveMemoNotes.create(byId("notebook"),()=>Content.parse(els.editor.value),fn=>mutateContent(md=>Content.updateJournal(md,fn),{render:false}),openBulletDialog,()=>els.fileId.value.trim());
function renderAll(){renderJournal();if(!els.notesPage.classList.contains("hidden"))noteEditor.render();renderTrash()}
function backupLegacyOnce(){const parsed=Content.parse(els.editor.value);if(parsed.hasJournal)return;try{const scope=(els.fileId.value.trim()||"local").replace(/[^a-zA-Z0-9_-]/g,"_");localStorage.setItem(`driveMemoV1Backup:${scope}:${Date.now()}`,els.editor.value)}catch{}}
let editSession=null,editFingerprint="",editTimer=null;
function trackEditorChanges(before,after){if(!editSession)return;const id=els.bulletId.value,previous=Content.getBullet(before,id),current=Content.getBullet(after,id);editSession.track(before,after,(kind,record)=>kind==="items"?(record.id===current?.itemId||record.id===previous?.itemId):record.id===id)}
function mutateContent(producer,{journal=true,render=true}={}){if(journal)backupLegacyOnce();const next=producer(els.editor.value);if(typeof next!=="string"||next===els.editor.value)return;trackEditorChanges(els.editor.value,next);els.editor.value=next;if(render)renderAll();sync.localContentChanged()}

function openBulletDialog(id="",initialDate=selectedDate,quick=false){
 const previousScroll=(dockSurface?.timeline||document.querySelector(".journal-timeline")).scrollTop,wasDocked=els.bulletDialog.classList.contains("docked-action");
 if(els.bulletDialog.open){if(!flushEdit(true))return;closeBulletDialog()}
 editSession=null;clearTimeout(editTimer);
 const bullet=id?Content.getBullet(els.editor.value,id):null;
 els.bulletDialog.classList.toggle("compact-action-edit",Boolean(bullet));
 els.bulletId.value=bullet?.id||"";els.bulletMode.value="action";
 els.bulletDialogTitle.textContent=quick?"Quick action":bullet?"編輯 Action":"新增 Action";
 els.actionField.classList.toggle("hidden",quick);els.actionDateField.classList.toggle("hidden",quick);els.actionPriorityField.classList.toggle("hidden",quick);
 els.bulletAction.required=false;els.bulletAction.value=bullet?.action||"";setBulletDate(bullet?.date||initialDate);setPriority(bullet?.priority||"today");
 els.bulletDialog.dataset.pending=String(quick||Boolean(bullet?.pending));els.bulletDialog.dataset.quick=String(quick);
 loadProjectDetailsEditor(bullet?.details||"");
 els.bulletHistoryField.classList.add("hidden");
 toggleDatePicker(false);showActionEditor();
 if(wasDocked&&dockSurface)dockSurface.timeline.scrollTop=previousScroll;
 editFingerprint=JSON.stringify(readEditData());editSession=Content.createEditSession();
 setTimeout(()=>quick?actionEditor.focus():els.bulletAction.focus(),0);
}
const dialogHome=els.bulletDialog.parentElement;
let dockPageScroll=0,dockSurface=null;
function shouldDockAction(){return innerWidth>820&&!els.journalPage.classList.contains("hidden")}
function sizeActionDock(){if(!dockSurface)return;const layout=dockSurface.layout;layout.style.setProperty("--dock-height",Math.max(240,innerHeight-layout.getBoundingClientRect().top-16)+"px")}
function highlightActiveAction(){document.querySelectorAll(".bullet.selected-action").forEach(row=>row.classList.remove("selected-action"));document.querySelectorAll('.bullet[aria-current="true"]').forEach(row=>row.removeAttribute("aria-current"));if(!els.bulletDialog.classList.contains("docked-action")||!els.bulletId.value)return;document.querySelectorAll(`.bullet[data-id="${CSS.escape(els.bulletId.value)}"]`).forEach(row=>{row.classList.add("selected-action");row.setAttribute("aria-current","true")})}
function showActionEditor(){if(shouldDockAction()){const page='journal';dockSurface={page,layout:document.querySelector('.'+page+'-layout'),timeline:document.querySelector('.'+page+'-timeline'),sidebar:document.querySelector('.'+page+'-sidebar')};dockPageScroll=scrollY;scrollTo(0,0);document.body.classList.add('action-dock-open');els.bulletDialog.classList.add('docked-action');dockSurface.sidebar.append(els.bulletDialog);els.bulletDialog.show();sizeActionDock();dockSurface.timeline.scrollTop=dockPageScroll;highlightActiveAction()}else els.bulletDialog.showModal()}
function undockActionEditor(){if(!dockSurface)return;document.querySelectorAll(".selected-project").forEach(card=>card.classList.remove("selected-project"));const {timeline,layout}=dockSurface,scroll=timeline.scrollTop;document.querySelectorAll('.bullet.selected-action').forEach(row=>row.classList.remove('selected-action'));document.querySelectorAll('.bullet[aria-current="true"]').forEach(row=>row.removeAttribute('aria-current'));els.bulletDialog.classList.remove('docked-action');document.body.classList.remove('action-dock-open','project-dock-open');dialogHome.append(els.bulletDialog);layout.style.removeProperty('--dock-height');timeline.scrollTop=0;dockSurface=null;scrollTo(0,scroll)}
function adaptActionEditor(){if(!els.bulletDialog.open)return;const docked=els.bulletDialog.classList.contains("docked-action"),dock=shouldDockAction();if(dock===docked){sizeActionDock();return}els.bulletDialog.close();undockActionEditor();showActionEditor()}
function closeBulletDialog(){clearTimeout(editTimer);editSession=null;hideImageHover();els.bulletDialog.close();undockActionEditor();loadProjectDetailsEditor("");renderAll()}
function readEditData(){return{action:els.bulletAction.value.trim(),date:els.bulletDate.value,priority:els.bulletPriority.value,pending:els.bulletDialog.dataset.pending==="true",details:serializeProjectDetails()}}
function flushEdit(force=false){if(!editSession)return true;clearTimeout(editTimer);try{const data=readEditData(),fingerprint=JSON.stringify(data),render=innerWidth>820;if(!force&&fingerprint===editFingerprint)return true;if(els.bulletId.value){mutateContent(markdown=>Content.updateBullet(markdown,els.bulletId.value,{...data,title:data.action}),{render})}else{mutateContent(markdown=>{const input={...data,action:data.action,title:data.action},created=Content.addBullet(markdown,input);els.bulletId.value=created.bulletId;return created.markdown},{render})}editFingerprint=fingerprint;return true}catch(error){sync.reportStatus(error.message,"err");return false}}
function queueEdit(){if(!editSession||!els.bulletDialog.open)return;clearTimeout(editTimer);editTimer=setTimeout(()=>flushEdit(),150)}
function cancelEdit(){const session=editSession;editSession=null;clearTimeout(editTimer);if(session)mutateContent(markdown=>session.rollback(markdown));closeBulletDialog()}
function finishEdit(){if(flushEdit(true))closeBulletDialog()}
function showToast(text,id){lastDeletedId=id;els.toastText.textContent=text;els.undoDeleteBtn.classList.remove("hidden");els.toast.classList.remove("hidden");clearTimeout(toastTimer);toastTimer=setTimeout(()=>{els.toast.classList.add("hidden");lastDeletedId=null},6000)}
function showAutosaveToast(text){lastDeletedId=null;els.toastText.textContent=text;els.undoDeleteBtn.classList.add("hidden");els.toast.classList.remove("hidden");clearTimeout(toastTimer);toastTimer=setTimeout(()=>els.toast.classList.add("hidden"),8000)}

function handleJournalClick(event){
 const target=event.target.closest("[data-action]");if(!target)return;const id=target.dataset.id;
 if(target.dataset.action==="add-day")openBulletDialog("",target.dataset.date);
 if(target.dataset.action==="open")openBulletDialog(id);
 if(target.dataset.action==="toggle"){const bullet=Content.getBullet(els.editor.value,id);if(bullet)mutateContent(markdown=>Content.setBulletStatus(markdown,id,bullet.status==="done"?"todo":"done"))}
}


function batchHighlight(action){const ids=[...els.rolloverList.querySelectorAll("input:checked")].map(n=>n.value);if(!ids.length)return;mutateContent(markdown=>Content.batchHighlight(markdown,ids,action))}
function carrySelected(all=false){const ids=all?[...els.rolloverList.querySelectorAll("input")].map(input=>input.value):[...els.rolloverList.querySelectorAll("input:checked")].map(input=>input.value);if(!ids.length){sync.reportStatus("請先勾選要順延的項目","");return}mutateContent(markdown=>Content.carryForward(markdown,ids,Content.localDateKey()))}

function route(){const page=["#notes","#projects"].includes(location.hash)?"notes":location.hash==="#passwords"?"passwords":location.hash==="#contacts"?"contacts":location.hash==="#small-cards"?"smallCards":["#settings","#sync-debug"].includes(location.hash)?"debug":"journal";if(dockSurface&&page!==dockSurface.page){if(!flushEdit(true)){location.hash="#"+dockSurface.page;return}closeBulletDialog()}els.journalPage.classList.toggle("hidden",page!=="journal");els.notesPage.classList.toggle("hidden",page!=="notes");els.passwordsPage.classList.toggle("hidden",page!=="passwords");els.contactsPage.classList.toggle("hidden",page!=="contacts");els.smallCardsPage.classList.toggle("hidden",page!=="smallCards");els.debugPage.classList.toggle("hidden",page!=="debug");els.journalNav.classList.toggle("active",page==="journal");els.notesNav.classList.toggle("active",page==="notes");if(page==="notes")noteEditor.render();els.passwordsNav.classList.toggle("active",page==="passwords");els.contactsNav.classList.toggle("active",page==="contacts");els.smallCardsNav.classList.toggle("active",page==="smallCards");els.debugNav.classList.toggle("active",page==="debug");if(["passwords","contacts","smallCards"].includes(page))passwordTools?.activate()}
function refreshSyncOverview(){
 update("syncOverview","日誌與筆記",els.stateDot,els.fileId.value,Boolean(els.dirtyState.textContent));
 update("sharedSyncOverview","共用資料",byId("sharedSyncStatus"),byId("passwordFileId").value);
 function update(id,label,status,fileId,dirty=false){
  const overview=byId(id),classes=status.classList;
  let kind="",summary;
  if(!fileId.trim())summary="未設定";
  else if(navigator.onLine===false)summary="離線";
  else if(!els.loginBtn.disabled)summary="未連線";
  else if(classes.contains("err")){kind="err";summary="異常"}
  else if(classes.contains("sync")||dirty){kind="sync";summary=classes.contains("sync")?"同步中":"待同步"}
  else if(classes.contains("ok")){kind="ok";summary="已同步"}
  else summary="待同步";
  overview.dataset.kind=kind;overview.textContent=label+" "+summary;
 }
}
function setStatus(text,kind=""){els.statusText.textContent=text;els.stateDot.className=`dot ${kind}`.trim();refreshSyncOverview()}
function setConnected(connected){els.loginBtn.disabled=connected;els.openBtn.disabled=false;els.syncBtn.disabled=!connected;passwordTools?.connected(connected);refreshSyncOverview()}
function setIdentity(value){identityValue=value;els.identity.textContent=value}
function setMeta(meta){const d=new Date(meta?.modifiedTime||""),stamp=Number.isNaN(d.getTime())?"":`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;els.fileMeta.textContent=meta?.name?meta.name+(stamp?" · "+stamp:""):""}
function setDirty(dirty){els.dirtyState.textContent=dirty?"有尚未同步的修改":"";refreshSyncOverview()}

let mergePlan=null;
function conflictValue(value,field){
 if(value===undefined||value===null||value==='')return '<span class="muted">（空白／已移除）</span>';
 if(field==='details')return renderProjectDetails(value);
 if(field==='record')return `<strong>${value.deletedAt||value.archivedAt?'已刪除／封存':'保留項目'}</strong><p>${escapeHtml(value.action||value.title||'未命名')}</p>${renderProjectDetails(value.details||'')}`;
 if(typeof value==='object')return escapeHtml(Object.entries(value).map(([key,v])=>`${key}: ${v}`).join('\n'));
 const names={todo:'未完成',done:'已完成',migrated:'已順延',open:'進行中',closed:'已結案',task:'一般 Action',project:'專案',true:'是',false:'否',...priorityNames};
 return escapeHtml(names[String(value)]||value);
}
function showConflict(data){
 flushEdit();mergePlan=global.DriveMemoMerge.prepare(data.baseContent||'',data.localContent,data.cloudContent);
 byId('reviewConflictBtn').classList.remove('hidden');
 els.diffView.textContent=mergePlan.conflicts.length?`共有 ${mergePlan.conflicts.length} 項衝突，請逐項選擇；其他不衝突的修改會一併保留。`:'兩邊修改沒有重疊，可以合併保留。';
 byId('mergeChoices').innerHTML=mergePlan.conflicts.map(c=>`<fieldset class="merge-choice"><legend>${escapeHtml(c.label)}</legend><div class="diff-grid">${['local','cloud'].map(side=>`<label><input type="radio" name="merge-${c.id}" value="${side}" data-merge-id="${c.id}">保留${side==='local'?'本機':'雲端'}<div class="diff-pane">${conflictValue(c[side],c.field)}</div></label>`).join('')}</div>${['details','legacyMarkdown'].includes(c.field)?`<label><input type="radio" name="merge-${c.id}" value="both" data-merge-id="${c.id}">保留兩邊筆記（本機在前，雲端接在後）</label>`:''}</fieldset>`).join('');
 byId('mergeError').textContent='';if(!els.conflictDialog.open)els.conflictDialog.showModal();
}
function closeConflict(){if(els.conflictDialog.open)els.conflictDialog.close();byId('reviewConflictBtn').classList.add('hidden')}
function exportLocalBackup(){flushEdit();const blob=new Blob([els.editor.value],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`Drive-Memo-backup-${Content.localDateKey()}.md`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

const sync=global.DriveMemoSync.create({
 config:global.APP_CONFIG||{},getFileId:()=>els.fileId.value,getImageFolderId:()=>byId("imageFolderId").value,getSmallCardImageFolderId:()=>byId("smallCardImageFolderId").value,getLocalContent:()=>els.editor.value,getIdentity:()=>identityValue,beforeRemoteApply:()=>flushEdit(),
 applyContent:content=>{if(els.bulletDialog.open)closeBulletDialog();els.editor.value=content;renderAll()},onStatus:setStatus,onDirty:setDirty,onMeta:setMeta,onIdentity:setIdentity,onConnected:setConnected,onConflict:showConflict,onConflictResolved:closeConflict,onAutosaveError:showAutosaveToast
});
let passwordTools=global.DriveMemoPasswords.create({cloud:sync,onFeedback:showAutosaveToast,onStatus:refreshSyncOverview,onFileIdChange:value=>writeSetting("driveMemoPasswordFileId",value)});


let journalTools=null;
function bindEvents(){
 addEventListener("resize",adaptActionEditor);
 document.addEventListener("pointerdown",sync.userActivity,{passive:true});document.addEventListener("keydown",sync.userActivity);
 els.bulletForm.addEventListener("input",queueEdit);els.bulletForm.addEventListener("change",queueEdit);els.bulletForm.addEventListener("click",queueEdit);
 const topActions=document.createElement("div");topActions.className="dialog-top-actions";
 const footer=els.bulletDialog.querySelector(".dialog-actions");
 topActions.append(footer.querySelector('[type="submit"]'),els.cancelBulletBtn);
 els.bulletDialog.querySelector(".dialog-head").append(topActions);footer.remove();
 let trashSwipe=null;function clearTrashSwipe(){if(trashSwipe?.row){trashSwipe.row.style.removeProperty("transform");trashSwipe.row.classList.remove("swiping-restore")}trashSwipe=null}els.debugPage.addEventListener("pointerdown",event=>{const row=event.target.closest("[data-trash-id]");if(!row||event.button!==0)return;trashSwipe={row,id:row.dataset.trashId,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,dx:0,active:false};row.setPointerCapture?.(event.pointerId)});els.debugPage.addEventListener("pointermove",event=>{if(!trashSwipe||trashSwipe.pointerId!==event.pointerId)return;const dx=Math.min(0,event.clientX-trashSwipe.startX),dy=event.clientY-trashSwipe.startY;if(!trashSwipe.active&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.2)trashSwipe.active=true;if(!trashSwipe.active)return;event.preventDefault();trashSwipe.dx=dx;trashSwipe.row.classList.add("swiping-restore");trashSwipe.row.style.transform=`translateX(${Math.max(-96,dx)}px)`});els.debugPage.addEventListener("pointerup",event=>{if(!trashSwipe||trashSwipe.pointerId!==event.pointerId)return;const id=trashSwipe.id,restore=trashSwipe.active&&trashSwipe.dx<=-72;clearTrashSwipe();if(restore){mutateContent(markdown=>Content.restoreBullet(markdown,id));sync.reportStatus("Action 已復原至原日期","ok")}});els.debugPage.addEventListener("pointercancel",clearTrashSwipe);
 journalTools=global.DriveMemoJournal.create({root:els.journalPage,content:Content,getText:()=>els.editor.value,mutate:mutateContent,onDrop:(id,date)=>{const editing=els.bulletDialog.open&&els.bulletMode.value==="action"&&Boolean(editSession);if(editing&&els.bulletId.value===id){const previousDate=els.bulletDate.value;setBulletDate(date);if(!flushEdit(true))setBulletDate(previousDate)}else{if(editing&&!flushEdit(true))return;mutateContent(markdown=>Content.updateBullet(markdown,id,{date}))}},onDates:dates=>{const x=scrollX,y=scrollY;if(dates.length)els.agenda.style.minHeight=els.agenda.offsetHeight+"px";else els.agenda.style.removeProperty("min-height");renderJournal();scrollTo(x,y)},onSwipe:(id,direction)=>{const bullet=Content.getBullet(els.editor.value,id);if(!bullet)return;if(direction==="right")mutateContent(markdown=>Content.setBulletStatus(markdown,id,bullet.status==="done"?"todo":"done"));else{mutateContent(markdown=>Content.softDeleteBullet(markdown,id));showToast(`已移至垃圾桶：「${bullet.action||bullet.title||"Action"}」`,id)}},onRange:range=>{els.agenda.style.removeProperty("min-height");agendaRange=range;renderJournal();els.journalPage.scrollIntoView({block:"start"})}});byId("quickMemoBtn").addEventListener("click",()=>openBulletDialog("",Content.localDateKey(),true));
 function positionMobileTools(){const v=global.visualViewport;document.documentElement.style.setProperty("--keyboard-inset",Math.max(0,innerHeight-(v?.height||innerHeight)-(v?.offsetTop||0))+"px")}
 global.visualViewport?.addEventListener("resize",positionMobileTools);global.visualViewport?.addEventListener("scroll",positionMobileTools);positionMobileTools();
 addEventListener("hashchange",route);
 addEventListener("online",refreshSyncOverview);
 addEventListener("offline",refreshSyncOverview);
 els.journalPage.addEventListener("click",handleJournalClick);els.rolloverSelectedBtn.addEventListener("click",()=>carrySelected(false));byId("rolloverSelectAll").addEventListener("click",()=>els.rolloverList.querySelectorAll("input").forEach(n=>n.checked=true));byId("rolloverSelectNone").addEventListener("click",()=>els.rolloverList.querySelectorAll("input").forEach(n=>n.checked=false));byId("rolloverDone").addEventListener("click",()=>batchHighlight("done"));byId("rolloverNextWeek").addEventListener("click",()=>batchHighlight("week"));
 els.priorityPicker.addEventListener("click",event=>{const button=event.target.closest("[data-priority]");if(button)setPriority(button.dataset.priority)});els.bulletDateButton.addEventListener("click",()=>toggleDatePicker());els.datePicker.addEventListener("click",event=>{const target=event.target.closest("[data-calendar]");if(!target)return;if(target.dataset.calendar==="previous")shiftCalendarMonth(-1);if(target.dataset.calendar==="next")shiftCalendarMonth(1);if(target.dataset.calendar==="select"){setBulletDate(target.dataset.date);toggleDatePicker(false)}});
 els.bulletDialog.addEventListener("cancel",event=>{event.preventDefault();cancelEdit()});
 document.addEventListener("mousemove",event=>{if(activeImageLink){hoverPoint={x:event.clientX,y:event.clientY};positionImageHover()}});document.addEventListener("mouseover",event=>{const link=event.target.closest?.(".project-image-link");if(link&&!link.contains(event.relatedTarget))showImageHover(link,event)});document.addEventListener("mouseout",event=>{const link=event.target.closest?.(".project-image-link");if(link&&!link.contains(event.relatedTarget))hideImageHover()});document.addEventListener("click",event=>{const link=event.target.closest?.(".project-image-link");if(link){event.preventDefault();openProjectImage(link)}});els.closeImageBtn.addEventListener("click",()=>els.imageDialog.close());els.imageDialog.addEventListener("click",event=>{if(event.target===els.imageDialog)els.imageDialog.close()});addEventListener("beforeunload",()=>imageUrlCache.forEach(url=>URL.revokeObjectURL(url)));
 els.cancelBulletBtn.addEventListener("click",cancelEdit);els.bulletForm.addEventListener("submit",event=>{event.preventDefault();finishEdit()});els.bulletForm.addEventListener("keydown",event=>{if(!event.isComposing&&(event.ctrlKey||event.metaKey)&&event.key==="Enter"){event.preventDefault();finishEdit()}});

 els.undoDeleteBtn.addEventListener("click",()=>{if(!lastDeletedId)return;mutateContent(markdown=>Content.restoreBullet(markdown,lastDeletedId));lastDeletedId=null;els.toast.classList.add("hidden")});
 els.editor.addEventListener("input",()=>{renderAll();sync.localContentChanged()});els.fileId.addEventListener("change",()=>sync.fileIdChanged());els.loginBtn.addEventListener("click",()=>sync.requestLogin());els.openBtn.addEventListener("click",()=>sync.openCurrentFile());els.syncBtn.addEventListener("click",()=>sync.syncCheck());
 byId('logoutBtn').addEventListener('click',()=>{flushEdit();sync.logout()});
 byId('exportBackupBtn').addEventListener('click',exportLocalBackup);
 byId('reviewConflictBtn').addEventListener('click',()=>sync.reviewConflict());
 byId('mergeBtn').addEventListener('click',async()=>{try{const choices=Object.fromEntries([...byId('mergeChoices').querySelectorAll('input:checked')].map(n=>[n.dataset.mergeId,n.value]));await sync.resolveMerged(mergePlan.build(choices))}catch(error){byId('mergeError').textContent=error.message}});
 els.conflictDialog.addEventListener('cancel',()=>sync.resolveLater());
 els.laterBtn.addEventListener("click",()=>{sync.resolveLater();els.conflictDialog.close()});els.cloudBtn.addEventListener("click",()=>sync.resolveUseCloud().catch(error=>{byId("mergeError").textContent=error.message}));els.localBtn.addEventListener("click",()=>sync.resolveKeepLocal().catch(error=>{byId("mergeError").textContent=error.message}));
 global.addEventListener('pagehide',()=>{flushEdit();sync.persistLocal()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){flushEdit();sync.persistLocal()}});
}

function readSetting(key){try{return localStorage.getItem(key)||""}catch{return ""}}
function writeSetting(key,value){try{localStorage.setItem(key,value)}catch{}}
function initialize(){byId("imageFolderId").value=readSetting("driveMemoImageFolderId")||"";byId("imageFolderId").addEventListener("change",()=>writeSetting("driveMemoImageFolderId",byId("imageFolderId").value.trim()));byId("smallCardImageFolderId").value=readSetting("driveMemoSmallCardImageFolderId")||"";byId("smallCardImageFolderId").addEventListener("change",()=>writeSetting("driveMemoSmallCardImageFolderId",byId("smallCardImageFolderId").value.trim()));els.fileId.value=readSetting("driveMemoFileId")||"";byId("passwordFileId").value=readSetting("driveMemoPasswordFileId")||"";passwordTools.initialize();bindEvents();route();renderAll();sync.initialize().catch(error=>setStatus(`初始化失敗：${error.message}`,"err"));if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{})}

initialize();
global.DriveMemoUI=Object.freeze({renderAll,sync});
})(window);
