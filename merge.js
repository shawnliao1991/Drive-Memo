(function(global){
"use strict";
const labels={title:"名稱",action:"Action 內容",details:"筆記",date:"日期",priority:"優先順序",status:"完成狀態",pending:"待確認",deletedAt:"刪除狀態",archivedAt:"封存狀態",projectStatus:"專案狀態",itemId:"所屬專案",kind:"項目類型",dateHistory:"日期歷程",completedAt:"完成時間",closedAt:"結案時間",convertedAt:"轉換時間",carriedFrom:"順延來源",carriedTo:"順延目的",legacyMarkdown:"舊版筆記",debugState:"其他設定"};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function prepare(base,local,cloud){
 const C=global.DriveMemoContent,b=C.parse(base),l=C.parse(local),r=C.parse(cloud),conflicts=[];
 function build(choices,collect=false){
  let index=0;
  function pick(before,left,right,label,field){
   if(equal(left,right))return left;
   if(equal(before,left))return right;
   if(equal(before,right))return left;
   const id=String(index++);
   if(collect){conflicts.push({id,label,field,local:left,cloud:right});return left}
   if(choices[id]==='both'&&['details','legacyMarkdown'].includes(field)&&typeof left==='string'&&typeof right==='string'){
    const marker='<!-- DRIVE_MEMO_RICH_DETAILS_V1 -->';
    if(field==='details'&&(left.startsWith(marker)||right.startsWith(marker))){const html=s=>s.startsWith(marker)?s.slice(marker.length):'<p>'+s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')+'</p>';return marker+html(left)+html(right)}
    return left+'\n\n'+right;
   }
   if(!['local','cloud'].includes(choices[id]))throw Error("請先選擇每一項差異要保留的版本");
   return choices[id]==='local'?left:right;
  }
  function records(key){
   const bm=new Map(b.journal[key].map(x=>[x.id,x])),lm=new Map(l.journal[key].map(x=>[x.id,x])),rm=new Map(r.journal[key].map(x=>[x.id,x]));
   return [...new Set([...bm.keys(),...lm.keys(),...rm.keys()])].map(id=>{
    const before=bm.get(id),left=lm.get(id),right=rm.get(id),record=left||right||before,label=(key==='bullets'?'Action：':'項目：')+(record.action||record.title||'未命名');
    if(!left||!right)return pick(before,left,right,label,'record');
    // A deletion versus an edit needs a whole-record choice; otherwise the edit could disappear into trash.
    const removed=x=>Boolean(x?.deletedAt||x?.archivedAt),meaningful=x=>Object.fromEntries(Object.entries(x||{}).filter(([k])=>!['updatedAt','createdAt'].includes(k)));
    if(before&&((removed(left)!==removed(before)&&!equal(meaningful(before),meaningful(right)))||(removed(right)!==removed(before)&&!equal(meaningful(before),meaningful(left)))))return pick(before,left,right,label+' · 刪除與修改','record');
    const result={id};
    for(const field of new Set([...Object.keys(before||{}),...Object.keys(left),...Object.keys(right)])){
     if(field==='id')continue;
     if(field==='updatedAt'||field==='createdAt'){result[field]=[left[field],right[field]].filter(Boolean).sort()[field==='createdAt'?0:1]||left[field]||right[field];continue}
     result[field]=pick(before?.[field],left[field],right[field],label+' · '+(labels[field]||'其他資料'),field);
    }
    return result;
   }).filter(Boolean);
  }
  const items=records('items'),bullets=records('bullets');
  const legacyMarkdown=pick(b.legacyMarkdown,l.legacyMarkdown,r.legacyMarkdown,'舊版筆記','legacyMarkdown');
  const debugState=pick(b.debugState,l.debugState,r.debugState,'其他設定','debugState');
  if(!collect&&bullets.some(x=>!items.some(item=>item.id===x.itemId)))throw Error("選取的 Action 缺少所屬項目，請保留對應項目後再合併");
  return C.serialize({...l,hasJournal:l.hasJournal||r.hasJournal,legacyMarkdown,debugState,journal:{...l.journal,items,bullets,updatedAt:new Date().toISOString()}});
 }
 build({},true);
 return{conflicts,build:choices=>build(choices)};
}
global.DriveMemoMerge={prepare};
})(window);
