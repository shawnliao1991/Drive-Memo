(function(global){
"use strict";

const FORMAT_VERSION=3;
const CONTENT_MARKER="DRIVE_MEMO_CONTENT_V3";
const CONTENT_END="DRIVE_MEMO_CONTENT_V3_END -->";
const CONTENT_RE=/<!-- DRIVE_MEMO_CONTENT_V[23]\r?\n([\s\S]*?)\r?\nDRIVE_MEMO_CONTENT_V[23]_END -->/;
const DEBUG_MARKER="DRIVE_MEMO_UI_STATE";
const DEBUG_RE=/<!-- DRIVE_MEMO_UI_STATE\r?\n([\s\S]*?)\r?\n-->/;
const PRIORITIES=["urgent","today","soon","someday"];
const STATUSES=["todo","done","migrated"];
const MAX_DETAILS_LENGTH=50000;
const DEFAULT_DEBUG_STATE={version:1,checked:false,switchOn:false,priority:"normal",stage:"todo",progress:25,note:"",updatedAt:""};

function nowIso(){return new Date().toISOString()}
function createId(prefix){const value=global.crypto?.randomUUID?.()||`${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;return`${prefix}_${value}`}
function localDateKey(date=new Date()){const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,"0"),day=String(date.getDate()).padStart(2,"0");return`${year}-${month}-${day}`}
function shiftDate(dateKey,days){const[y,m,d]=dateKey.split("-").map(Number),date=new Date(y,m-1,d+days,12);return localDateKey(date)}
function normalizeDebugState(value={}){const priority=["low","normal","high"].includes(value.priority)?value.priority:"normal",stage=["todo","doing","waiting","done"].includes(value.stage)?value.stage:"todo",progress=Math.max(0,Math.min(100,Number(value.progress)||0));return{version:1,checked:Boolean(value.checked),switchOn:Boolean(value.switchOn),priority,stage,progress,note:String(value.note||"").slice(0,80),updatedAt:String(value.updatedAt||"")}}
function emptyJournal(){return{version:FORMAT_VERSION,createdAt:nowIso(),updatedAt:nowIso(),items:[],bullets:[]}}
function normalizeItem(item){const kind=item.kind==="project"?"project":"task",projectStatus=kind==="project"&&(item.projectStatus==="closed"?"closed":"open");return{id:String(item.id||""),kind,title:String(item.title||"未命名項目").slice(0,160),details:String(item.details||"").slice(0,MAX_DETAILS_LENGTH),projectStatus:projectStatus||null,convertedAt:kind==="project"&&item.convertedAt?String(item.convertedAt):null,closedAt:kind==="project"&&item.closedAt?String(item.closedAt):null,createdAt:String(item.createdAt||nowIso()),updatedAt:String(item.updatedAt||item.createdAt||nowIso()),archivedAt:item.archivedAt?String(item.archivedAt):null}}
function normalizeBullet(bullet){return{id:String(bullet.id||""),itemId:String(bullet.itemId||""),date:/^\d{4}-\d{2}-\d{2}$/.test(bullet.date||"")?bullet.date:localDateKey(),dateHistory:Array.isArray(bullet.dateHistory)?[...new Set(bullet.dateHistory.filter(value=>/^\d{4}-\d{2}-\d{2}$/.test(value||"")))]:[],action:String(bullet.action||"").slice(0,500),details:bullet.details===undefined?undefined:String(bullet.details||"").slice(0,MAX_DETAILS_LENGTH),priority:PRIORITIES.includes(bullet.priority)?bullet.priority:"someday",pending:Boolean(bullet.pending),status:STATUSES.includes(bullet.status)?bullet.status:"todo",createdAt:String(bullet.createdAt||nowIso()),updatedAt:String(bullet.updatedAt||bullet.createdAt||nowIso()),completedAt:bullet.completedAt?String(bullet.completedAt):null,carriedFrom:bullet.carriedFrom?String(bullet.carriedFrom):null,carriedTo:bullet.carriedTo?String(bullet.carriedTo):null,deletedAt:bullet.deletedAt?String(bullet.deletedAt):null}}
function normalizeJournal(value={}){const items=Array.isArray(value.items)?value.items.map(normalizeItem).filter(item=>item.id):[],itemIds=new Set(items.map(item=>item.id)),bullets=Array.isArray(value.bullets)?value.bullets.map(normalizeBullet).filter(bullet=>bullet.id&&itemIds.has(bullet.itemId)):[];for(const bullet of bullets){if(bullet.details===undefined){const item=items.find(item=>item.id===bullet.itemId);bullet.details=item.kind==="task"?item.details:""}}return{version:FORMAT_VERSION,createdAt:String(value.createdAt||nowIso()),updatedAt:String(value.updatedAt||nowIso()),items,bullets}}

function parse(markdown=""){
 const raw=String(markdown||""),contentMatch=raw.match(CONTENT_RE),debugMatch=raw.match(DEBUG_RE);let journal=emptyJournal(),debugState={...DEFAULT_DEBUG_STATE},hasJournal=false;
 if(contentMatch){try{journal=normalizeJournal(JSON.parse(contentMatch[1]));hasJournal=true}catch(error){console.warn("牛馬日誌資料無法解析",error)}}
 if(debugMatch){try{debugState=normalizeDebugState(JSON.parse(debugMatch[1]))}catch(error){console.warn("互動狀態資料無法解析",error)}}
 const legacyMarkdown=raw.replace(CONTENT_RE,"").replace(DEBUG_RE,"").trimEnd();
 return{formatVersion:FORMAT_VERSION,hasJournal,legacyMarkdown,journal,debugState}
}

function serialize(model,{includeJournal=model.hasJournal}={}){
 const parts=[],legacy=String(model.legacyMarkdown||"").trimEnd();if(legacy)parts.push(legacy);
 if(includeJournal){const journal=normalizeJournal(model.journal);parts.push(`<!-- ${CONTENT_MARKER}\n${JSON.stringify(journal,null,2)}\n${CONTENT_END}`)}
 const debugState=normalizeDebugState(model.debugState);parts.push(`<!-- ${DEBUG_MARKER}\n${JSON.stringify(debugState,null,2)}\n-->`);return parts.join("\n\n")
}

function updateJournal(markdown,mutator){const model=parse(markdown),journal=normalizeJournal(model.journal);mutator(journal);journal.updatedAt=nowIso();model.journal=journal;model.hasJournal=true;return serialize(model,{includeJournal:true})}
function updateDebugState(markdown,patch){const model=parse(markdown);model.debugState=normalizeDebugState({...model.debugState,...patch,updatedAt:nowIso()});return serialize(model,{includeJournal:model.hasJournal})}

function addBullet(markdown,input={}){
 const itemId=createId("item"),bulletId=createId("bullet"),createdAt=nowIso();
 const next=updateJournal(markdown,journal=>{journal.items.push(normalizeItem({id:itemId,title:input.title,details:input.details,createdAt,updatedAt:createdAt}));journal.bullets.push(normalizeBullet({id:bulletId,itemId,date:input.date||localDateKey(),action:input.action,details:input.details,priority:input.priority,pending:input.pending,status:"todo",createdAt,updatedAt:createdAt}))});
 return{markdown:next,itemId,bulletId}
}
function addProjectAction(markdown,itemId,input={}){let bulletId="";const next=updateJournal(markdown,journal=>{const item=journal.items.find(value=>value.id===itemId&&value.kind==="project");if(!item)return;const createdAt=nowIso();bulletId=createId("bullet");journal.bullets.push(normalizeBullet({id:bulletId,itemId,date:input.date||localDateKey(),action:input.action,details:input.details,priority:input.priority,pending:input.pending,status:"todo",createdAt,updatedAt:createdAt}));item.updatedAt=createdAt});return{markdown:next,itemId,bulletId}}
function updateProject(markdown,itemId,patch={}){return updateJournal(markdown,journal=>{const item=journal.items.find(value=>value.id===itemId&&value.kind==="project");if(!item)return;if(patch.title!==undefined)item.title=String(patch.title||"未命名專案").slice(0,160);if(patch.details!==undefined)item.details=String(patch.details||"").slice(0,MAX_DETAILS_LENGTH);item.updatedAt=nowIso()})}

function updateBullet(markdown,bulletId,patch={}){return updateJournal(markdown,journal=>{const bullet=journal.bullets.find(value=>value.id===bulletId);if(!bullet)return;const item=journal.items.find(value=>value.id===bullet.itemId),updatedAt=nowIso();if(item){if(patch.title!==undefined)item.title=String(patch.title||"未命名項目").slice(0,160);item.updatedAt=updatedAt}if(patch.details!==undefined)bullet.details=String(patch.details||"").slice(0,MAX_DETAILS_LENGTH);if(patch.action!==undefined)bullet.action=String(patch.action||"").slice(0,500);if(patch.priority!==undefined&&PRIORITIES.includes(patch.priority)){bullet.priority=patch.priority;bullet.pending=false}if(patch.pending!==undefined)bullet.pending=Boolean(patch.pending);if(patch.date!==undefined&&/^\d{4}-\d{2}-\d{2}$/.test(patch.date)&&patch.date!==bullet.date){bullet.dateHistory=[...new Set([...(bullet.dateHistory||[]),bullet.date])];bullet.date=patch.date}bullet.updatedAt=updatedAt})}
function convertToProject(markdown,bulletId){return updateJournal(markdown,journal=>{const bullet=journal.bullets.find(value=>value.id===bulletId);if(!bullet)return;const item=journal.items.find(value=>value.id===bullet.itemId);if(!item||item.kind==="project")return;const updatedAt=nowIso();item.details="";item.kind="project";item.projectStatus="open";item.convertedAt=updatedAt;item.closedAt=null;item.updatedAt=updatedAt})}
function assignProject(markdown,bulletId,projectId){return updateJournal(markdown,journal=>{const bullet=journal.bullets.find(b=>b.id===bulletId),project=journal.items.find(i=>i.id===projectId&&i.kind==="project"&&i.projectStatus==="open");if(!bullet||!project)return;bullet.itemId=projectId;bullet.updatedAt=nowIso()})}
// Track only fields changed by this editing session so cancel preserves unrelated updates.
function createEditSession(){const changes=new Map(),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);return{
 track(before,after,include=()=>true){const a=parse(before).journal,b=parse(after).journal;for(const kind of ["items","bullets"]){const previous=new Map(a[kind].map(record=>[record.id,record]));for(const record of b[kind]){if(!include(kind,record))continue;const prior=previous.get(record.id);if(equal(prior,record))continue;const key=kind+":"+record.id;let change=changes.get(key);if(!change){change={kind,id:record.id,created:!prior,fields:{}};changes.set(key,change)}for(const field of Object.keys(record)){if(equal(prior?.[field],record[field]))continue;if(!change.fields[field])change.fields[field]={before:prior?.[field]};change.fields[field].after=record[field]}}}},
 rollback(markdown){return updateJournal(markdown,journal=>{for(const change of [...changes.values()].sort((a,b)=>(a.kind==="items")-(b.kind==="items"))){const records=journal[change.kind],index=records.findIndex(r=>r.id===change.id);if(index<0)continue;const record=records[index];if(change.created){if(change.kind==="items"&&journal.bullets.some(b=>b.itemId===record.id))continue;records.splice(index,1);continue}for(const [field,value] of Object.entries(change.fields))if(equal(record[field],value.after)){if(value.before===undefined)delete record[field];else record[field]=value.before}}})}
}}
function setProjectStatus(markdown,itemId,status){if(!["open","closed"].includes(status))return markdown;return updateJournal(markdown,journal=>{const item=journal.items.find(value=>value.id===itemId&&value.kind==="project");if(!item)return;const updatedAt=nowIso();item.projectStatus=status;item.closedAt=status==="closed"?updatedAt:null;item.updatedAt=updatedAt})}
function setBulletStatus(markdown,bulletId,status){if(!["todo","done"].includes(status))return markdown;return updateJournal(markdown,journal=>{const bullet=journal.bullets.find(value=>value.id===bulletId);if(!bullet||bullet.deletedAt)return;bullet.status=status;bullet.completedAt=status==="done"?nowIso():null;bullet.updatedAt=nowIso()})}
function softDeleteBullet(markdown,bulletId){return updateJournal(markdown,journal=>{const bullet=journal.bullets.find(value=>value.id===bulletId);if(bullet){bullet.deletedAt=nowIso();bullet.updatedAt=bullet.deletedAt}})}
function restoreBullet(markdown,bulletId){return updateJournal(markdown,journal=>{const bullet=journal.bullets.find(value=>value.id===bulletId);if(bullet){bullet.deletedAt=null;bullet.updatedAt=nowIso()}})}

function carryForward(markdown,bulletIds,targetDate=localDateKey()){
 const selected=new Set(bulletIds);return updateJournal(markdown,journal=>{for(const source of journal.bullets){if(!selected.has(source.id)||source.status!=="todo"||source.deletedAt||source.carriedTo||source.date>=targetDate)continue;source.dateHistory=[...new Set([...(source.dateHistory||[]),source.date])];source.date=targetDate;source.updatedAt=nowIso()}})
}

function decorate(bullet,itemMap){const item=itemMap.get(bullet.itemId)||normalizeItem({id:bullet.itemId});return{...bullet,title:item.title,details:bullet.details,projectDetails:item.kind==="project"?item.details:"",kind:item.kind,projectStatus:item.projectStatus,itemArchivedAt:item.archivedAt}}
function chainResolved(bullet,bulletMap){let current=bullet,guard=0;while(current?.carriedTo&&guard++<100)current=bulletMap.get(current.carriedTo);return current?.status==="done"}
function priorityRank(priority){return PRIORITIES.indexOf(priority)}
function sortBullets(a,b){return priorityRank(a.priority)-priorityRank(b.priority)||a.createdAt.localeCompare(b.createdAt)}

function getViewModel(markdown,selectedDate=localDateKey()){
 const model=parse(markdown),journal=model.journal,itemMap=new Map(journal.items.map(item=>[item.id,item])),bulletMap=new Map(journal.bullets.map(bullet=>[bullet.id,bullet]));
 const active=journal.bullets.filter(bullet=>!bullet.deletedAt&&bullet.date===selectedDate).map(bullet=>decorate(bullet,itemMap));
 const todo=active.filter(bullet=>bullet.status==="todo").sort(sortBullets),done=active.filter(bullet=>bullet.status==="done").sort((a,b)=>(b.completedAt||"").localeCompare(a.completedAt||""));
 const timelineMap=new Map();for(const bullet of journal.bullets.filter(value=>!value.deletedAt&&(value.status!=="todo"||value.date<selectedDate))){if(!timelineMap.has(bullet.date))timelineMap.set(bullet.date,[]);const entry=decorate(bullet,itemMap);entry.chainResolved=chainResolved(bullet,bulletMap);entry.isHighlight=["urgent","today"].includes(bullet.priority);timelineMap.get(bullet.date).push(entry)}
 const timeline=[...timelineMap.entries()].sort(([a],[b])=>b.localeCompare(a)).map(([date,bullets])=>({date,bullets:bullets.sort((a,b)=>a.createdAt.localeCompare(b.createdAt))}));
 const carryCandidates=journal.bullets.filter(bullet=>!bullet.deletedAt&&bullet.status==="todo"&&!bullet.carriedTo&&bullet.date<selectedDate).map(bullet=>decorate(bullet,itemMap)).sort((a,b)=>a.date.localeCompare(b.date)||sortBullets(a,b));
 return{formatVersion:FORMAT_VERSION,hasJournal:model.hasJournal,legacyMarkdown:model.legacyMarkdown,debugState:model.debugState,selectedDate,now:todo.filter(bullet=>["urgent","today"].includes(bullet.priority)),next:todo.filter(bullet=>["soon","someday"].includes(bullet.priority)),done,timeline,carryCandidates}
}

function getAgenda(markdown,startDate=localDateKey(),dayCount=8){
 const model=parse(markdown),journal=model.journal,itemMap=new Map(journal.items.map(item=>[item.id,item])),count=Math.max(2,Math.min(31,Number(dayCount)||8)),days=[];
 for(let index=0;index<count;index++){const date=shiftDate(startDate,index),bullets=journal.bullets.filter(value=>!value.deletedAt&&value.date===date&&value.status!=="migrated").map(value=>decorate(value,itemMap)),todo=bullets.filter(value=>value.status==="todo").sort(sortBullets),done=bullets.filter(value=>value.status==="done").sort((a,b)=>(b.completedAt||"").localeCompare(a.completedAt||""));days.push({date,todo,done})}
 return days
}

function getBullet(markdown,bulletId){const model=parse(markdown),bullet=model.journal.bullets.find(value=>value.id===bulletId);if(!bullet)return null;const item=model.journal.items.find(value=>value.id===bullet.itemId);return item?decorate(bullet,new Map([[item.id,item]])):null}
function getItemHistory(markdown,bulletId){const model=parse(markdown),current=model.journal.bullets.find(value=>value.id===bulletId);if(!current)return[];const itemMap=new Map(model.journal.items.map(item=>[item.id,item]));return model.journal.bullets.filter(value=>value.itemId===current.itemId&&!value.deletedAt).map(value=>decorate(value,itemMap)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))}
function getProjects(markdown){const model=parse(markdown),projects=model.journal.items.filter(item=>item.kind==="project"&&!item.archivedAt).map(item=>{const bullets=model.journal.bullets.filter(bullet=>bullet.itemId===item.id&&!bullet.deletedAt&&bullet.status!=="migrated"),actions=[...bullets].sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)).map(bullet=>({...bullet})),active=bullets.filter(bullet=>bullet.status==="todo").sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)),latest=[...bullets].sort((a,b)=>(b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt))[0],current=active[0]||latest||null,lastActivity=[item.updatedAt,...bullets.map(bullet=>bullet.updatedAt||bullet.createdAt)].filter(Boolean).sort().at(-1)||item.createdAt;return{...item,bulletId:current?.id||null,actions,lastActivity}});return projects.sort((a,b)=>(a.projectStatus==="closed")-(b.projectStatus==="closed")||b.lastActivity.localeCompare(a.lastActivity))}
function getTrash(markdown){const model=parse(markdown),itemMap=new Map(model.journal.items.map(item=>[item.id,item]));return model.journal.bullets.filter(bullet=>bullet.deletedAt).map(bullet=>decorate(bullet,itemMap)).sort((a,b)=>(b.deletedAt||"").localeCompare(a.deletedAt||""))}
function toViewModel(markdown){const model=parse(markdown);return{formatVersion:model.formatVersion,categories:[{id:"memo",label:"舊版筆記內容",items:[{id:"main",type:"markdown",content:model.legacyMarkdown}]}],debugState:model.debugState}}

function batchHighlight(markdown,ids,action,today=localDateKey()){const todayDay=new Date(today+"T12:00:00").getDay()||7,nextMonday=shiftDate(today,8-todayDay);return ids.reduce((text,id)=>{const b=getBullet(text,id);if(!b||b.status!=="todo")return text;if(action==="done")return setBulletStatus(text,id,"done");const weekday=new Date(b.date+"T12:00:00").getDay()||7;return updateBullet(text,id,{date:shiftDate(nextMonday,weekday-1)})},markdown)}

function getAgendaRange(markdown,start=localDateKey(),range="week"){const model=parse(markdown),dates=new Set(Array.from({length:8},(_,i)=>shiftDate(start,i))),[y,m,d]=start.split("-").map(Number),lastDay=new Date(y,m+1,0,12).getDate(),end=localDateKey(new Date(y,m,Math.min(d,lastDay),12));if(range!=="week")for(const b of model.journal.bullets)if(!b.deletedAt&&b.status!=="migrated"&&b.date>=start&&(range==="future"||b.date<=end))dates.add(b.date);const itemMap=new Map(model.journal.items.map(i=>[i.id,i])),groups=new Map([...dates].map(date=>[date,{date,todo:[],done:[]}]));for(const b of model.journal.bullets){if(b.deletedAt||!groups.has(b.date)||!["todo","done"].includes(b.status))continue;groups.get(b.date)[b.status].push(decorate(b,itemMap))}return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(day=>({...day,todo:day.todo.sort(sortBullets),done:day.done.sort((a,b)=>(b.completedAt||"").localeCompare(a.completedAt||""))}))}
function getMonthCounts(markdown,month){const counts={};for(const b of parse(markdown).journal.bullets){if(b.deletedAt||b.status==="migrated"||!b.date.startsWith(month+"-"))continue;const entry=counts[b.date]||(counts[b.date]={urgent:0,today:0,soon:0,someday:0,pending:0});entry[b.pending?"pending":b.priority]++}return counts}
global.DriveMemoContent=Object.freeze({assignProject,createEditSession,getAgendaRange,getMonthCounts,getTrash,batchHighlight,FORMAT_VERSION,PRIORITIES,STATUSES,DEFAULT_DEBUG_STATE:Object.freeze({...DEFAULT_DEBUG_STATE}),localDateKey,shiftDate,parse,serialize,updateDebugState,addBullet,addProjectAction,updateProject,updateBullet,convertToProject,setProjectStatus,setBulletStatus,softDeleteBullet,restoreBullet,carryForward,getViewModel,getAgenda,getBullet,getItemHistory,getProjects,toViewModel});
})(window);
