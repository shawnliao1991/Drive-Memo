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
const DEFAULT_DEBUG_STATE={version:1,checked:false,switchOn:false,priority:"normal",stage:"todo",progress:25,note:"",updatedAt:""};

function nowIso(){return new Date().toISOString()}
function createId(prefix){const value=global.crypto?.randomUUID?.()||`${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;return`${prefix}_${value}`}
function localDateKey(date=new Date()){const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,"0"),day=String(date.getDate()).padStart(2,"0");return`${year}-${month}-${day}`}
function shiftDate(dateKey,days){const[y,m,d]=dateKey.split("-").map(Number),date=new Date(y,m-1,d+days,12);return localDateKey(date)}
function normalizeDebugState(value={}){const priority=["low","normal","high"].includes(value.priority)?value.priority:"normal",stage=["todo","doing","waiting","done"].includes(value.stage)?value.stage:"todo",progress=Math.max(0,Math.min(100,Number(value.progress)||0));return{version:1,checked:Boolean(value.checked),switchOn:Boolean(value.switchOn),priority,stage,progress,note:String(value.note||"").slice(0,80),updatedAt:String(value.updatedAt||"")}}
function emptyJournal(){return{version:FORMAT_VERSION,createdAt:nowIso(),updatedAt:nowIso(),items:[],bullets:[]}}
function normalizeItem(item){const kind=item.kind==="project"?"project":"task",projectStatus=kind==="project"&&(item.projectStatus==="closed"?"closed":"open");return{id:String(item.id||""),kind,title:String(item.title||"未命名項目").slice(0,160),details:String(item.details||"").slice(0,12000),projectStatus:projectStatus||null,convertedAt:kind==="project"&&item.convertedAt?String(item.convertedAt):null,closedAt:kind==="project"&&item.closedAt?String(item.closedAt):null,createdAt:String(item.createdAt||nowIso()),updatedAt:String(item.updatedAt||item.createdAt||nowIso()),archivedAt:item.archivedAt?String(item.archivedAt):null}}
function normalizeBullet(bullet){return{id:String(bullet.id||""),itemId:String(bullet.itemId||""),date:/^\d{4}-\d{2}-\d{2}$/.test(bullet.date||"")?bullet.date:localDateKey(),action:String(bullet.action||"").slice(0,500),priority:PRIORITIES.includes(bullet.priority)?bullet.priority:"someday",status:STATUSES.includes(bullet.status)?bullet.status:"todo",createdAt:String(bullet.createdAt||nowIso()),updatedAt:String(bullet.updatedAt||bullet.createdAt||nowIso()),completedAt:bullet.completedAt?String(bullet.completedAt):null,carriedFrom:bullet.carriedFrom?String(bullet.carriedFrom):null,carriedTo:bullet.carriedTo?String(bullet.carriedTo):null,deletedAt:bullet.deletedAt?String(bullet.deletedAt):null}}
function normalizeJournal(value={}){const items=Array.isArray(value.items)?value.items.map(normalizeItem).filter(item=>item.id):[],itemIds=new Set(items.map(item=>item.id)),bullets=Array.isArray(value.bullets)?value.bullets.map(normalizeBullet).filter(bullet=>bullet.id&&itemIds.has(bullet.itemId)):[];return{version:FORMAT_VERSION,createdAt:String(value.createdAt||nowIso()),updatedAt:String(value.updatedAt||nowIso()),items,bullets}}

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
 const next=updateJournal(markdown,journal=>{journal.items.push(normalizeItem({id:itemId,title:input.title,details:input.details,createdAt,updatedAt:createdAt}));journal.bullets.push(normalizeBullet({id:bulletId,itemId,date:input.date||localDateKey(),action:input.action,priority:input.priority,status:"todo",createdAt,updatedAt:createdAt}))});
 return{markdown:next,itemId,bulletId}
}

function updateBullet(markdown,bulletId,patch={}){return updateJournal(markdown,journal=>{const bullet=journal.bullets.find(value=>value.id===bulletId);if(!bullet)return;const item=journal.items.find(value=>value.id===bullet.itemId),updatedAt=nowIso();if(item){if(patch.title!==undefined)item.title=String(patch.title||"未命名項目").slice(0,160);if(patch.details!==undefined)item.details=String(patch.details||"").slice(0,12000);item.updatedAt=updatedAt}if(patch.action!==undefined)bullet.action=String(patch.action||"").slice(0,500);if(patch.priority!==undefined&&PRIORITIES.includes(patch.priority))bullet.priority=patch.priority;if(patch.date!==undefined&&/^\d{4}-\d{2}-\d{2}$/.test(patch.date))bullet.date=patch.date;bullet.updatedAt=updatedAt})}
function convertToProject(markdown,bulletId){return updateJournal(markdown,journal=>{const bullet=journal.bullets.find(value=>value.id===bulletId);if(!bullet)return;const item=journal.items.find(value=>value.id===bullet.itemId);if(!item||item.kind==="project")return;const updatedAt=nowIso();item.kind="project";item.projectStatus="open";item.convertedAt=updatedAt;item.closedAt=null;item.updatedAt=updatedAt})}
function setProjectStatus(markdown,itemId,status){if(!["open","closed"].includes(status))return markdown;return updateJournal(markdown,journal=>{const item=journal.items.find(value=>value.id===itemId&&value.kind==="project");if(!item)return;const updatedAt=nowIso();item.projectStatus=status;item.closedAt=status==="closed"?updatedAt:null;item.updatedAt=updatedAt})}
function setBulletStatus(markdown,bulletId,status){if(!["todo","done"].includes(status))return markdown;return updateJournal(markdown,journal=>{const bullet=journal.bullets.find(value=>value.id===bulletId);if(!bullet||bullet.deletedAt)return;bullet.status=status;bullet.completedAt=status==="done"?nowIso():null;bullet.updatedAt=nowIso()})}
function softDeleteBullet(markdown,bulletId){return updateJournal(markdown,journal=>{const bullet=journal.bullets.find(value=>value.id===bulletId);if(bullet){bullet.deletedAt=nowIso();bullet.updatedAt=bullet.deletedAt}})}
function restoreBullet(markdown,bulletId){return updateJournal(markdown,journal=>{const bullet=journal.bullets.find(value=>value.id===bulletId);if(bullet){bullet.deletedAt=null;bullet.updatedAt=nowIso()}})}

function carryForward(markdown,bulletIds,targetDate=localDateKey()){
 const selected=new Set(bulletIds);return updateJournal(markdown,journal=>{for(const source of journal.bullets){if(!selected.has(source.id)||source.status!=="todo"||source.deletedAt||source.carriedTo||source.date>=targetDate)continue;const newId=`carry_${source.id}_${targetDate}`;if(journal.bullets.some(value=>value.id===newId)){source.status="migrated";source.carriedTo=newId;continue}const createdAt=nowIso();journal.bullets.push(normalizeBullet({id:newId,itemId:source.itemId,date:targetDate,action:source.action,priority:source.priority,status:"todo",createdAt,updatedAt:createdAt,carriedFrom:source.id}));source.status="migrated";source.carriedTo=newId;source.updatedAt=createdAt}})
}

function decorate(bullet,itemMap){const item=itemMap.get(bullet.itemId)||normalizeItem({id:bullet.itemId});return{...bullet,title:item.title,details:item.details,kind:item.kind,projectStatus:item.projectStatus,itemArchivedAt:item.archivedAt}}
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

function getBullet(markdown,bulletId){const model=parse(markdown),bullet=model.journal.bullets.find(value=>value.id===bulletId);if(!bullet)return null;const item=model.journal.items.find(value=>value.id===bullet.itemId);return item?{...bullet,title:item.title,details:item.details,kind:item.kind,projectStatus:item.projectStatus}:null}
function getItemHistory(markdown,bulletId){const model=parse(markdown),current=model.journal.bullets.find(value=>value.id===bulletId);if(!current)return[];const itemMap=new Map(model.journal.items.map(item=>[item.id,item]));return model.journal.bullets.filter(value=>value.itemId===current.itemId&&!value.deletedAt).map(value=>decorate(value,itemMap)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))}
function getProjects(markdown){const model=parse(markdown),projects=model.journal.items.filter(item=>item.kind==="project"&&!item.archivedAt).map(item=>{const bullets=model.journal.bullets.filter(bullet=>bullet.itemId===item.id&&!bullet.deletedAt),active=bullets.filter(bullet=>bullet.status==="todo").sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)),latest=[...bullets].sort((a,b)=>(b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt))[0],current=active[0]||latest||null,lastActivity=[item.updatedAt,...bullets.map(bullet=>bullet.updatedAt||bullet.createdAt)].filter(Boolean).sort().at(-1)||item.createdAt;return{...item,bulletId:current?.id||null,action:current?.action||"尚未安排 Action",date:current?.date||"",priority:current?.priority||"someday",bulletStatus:current?.status||"",lastActivity}});return projects.sort((a,b)=>(a.projectStatus==="closed")-(b.projectStatus==="closed")||b.lastActivity.localeCompare(a.lastActivity))}
function toViewModel(markdown){const model=parse(markdown);return{formatVersion:model.formatVersion,categories:[{id:"memo",label:"舊版筆記內容",items:[{id:"main",type:"markdown",content:model.legacyMarkdown}]}],debugState:model.debugState}}

global.DriveMemoContent=Object.freeze({FORMAT_VERSION,PRIORITIES,STATUSES,DEFAULT_DEBUG_STATE:Object.freeze({...DEFAULT_DEBUG_STATE}),localDateKey,shiftDate,parse,serialize,updateDebugState,addBullet,updateBullet,convertToProject,setProjectStatus,setBulletStatus,softDeleteBullet,restoreBullet,carryForward,getViewModel,getAgenda,getBullet,getItemHistory,getProjects,toViewModel});
})(window);
