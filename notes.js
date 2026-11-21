(function(global){
"use strict";
const rowMime="application/x-drive-memo-rows",actionMime="application/x-drive-memo-action";
const textRow=(text="",depth=0)=>({type:"text",text,depth});
const icons=["▤","▧","★","●","◆","✎","☀","☑","⚑","♥","⌂","♫"];
const ordered=list=>[...list].sort((a,b)=>a.order-b.order);
function normalize(rows){
 let previous=-1;
 return rows.map(r=>{
  const depth=Math.min(previous+1,Math.max(0,Math.floor(Number(r.depth)||0)));previous=depth;
  return {type:["link","image","action"].includes(r.type)?r.type:"text",text:String(r.text??""),depth,...(r.collapsed?{collapsed:true}:{})};
 });
}
function endOfBranch(rows,index){let end=index+1;while(end<rows.length&&rows[end].depth>rows[index].depth)end++;return end}
function httpURL(value){try{const u=new URL(value);if(["https:","http:"].includes(u.protocol))return u.href}catch{}return ""}
function imageURL(value){return httpURL(value)||(/^data:image\/(?:png|jpeg|gif|webp|avif);base64,[A-Za-z0-9+/=\s]+$/i.test(value)?value:"")}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function btn(label,cls,fn){const n=el("button",cls,label);n.type="button";n.onclick=fn;return n}
function create(root,read,write,openAction,fileId=()=>""){
 const data=()=>read().journal;
 let bookId="",pageId="",anchor=null,head=null,drag=null,marker=null,visible=[];
 const main=el("section","note-paper"),title=el("h1"),body=el("div","note-tree"),nav=el("aside","note-nav");
 const editorDialog=el("dialog","note-card-dialog"),form=el("form"),name=el("input"),icon=el("select"),color=el("input");
 name.required=true;name.maxLength=120;color.type="color";for(const v of icons)icon.add(new Option(v,v));
 let saveCard;
 function label(text,field){const label=el("label","",text);label.append(field);return label}
 form.append(label("名稱",name),label("圖示",icon),label("文字顏色",color),btn("取消","",()=>editorDialog.close()),el("button","","儲存"));
 form.onsubmit=e=>{e.preventDefault();if(!name.value.trim())return;saveCard({title:name.value.trim(),icon:icon.value,color:color.value});editorDialog.close();render()};
 editorDialog.append(form);
 const header=el("header","note-heading"),help=el("dialog","note-instructions"),list=el("ul");
 const info=btn("ⓘ","note-info",()=>help.showModal());
 info.setAttribute("aria-label","查看筆記操作說明");info.setAttribute("aria-haspopup","dialog");
 help.setAttribute("aria-label","筆記操作說明");
 for(const hint of ["↑／↓ 直接切換到相鄰可見列。游標靠前時到列首，靠後時到列尾。","Enter 分列；下一列是子列時，會新增同層子列。","列尾按 Delete 或下一列開頭按 Backspace，可合併相鄰文字列。","Tab 增加縮排，Shift＋Tab 減少縮排。","Shift＋↑／↓ 第一次選取目前列，再按延伸選取。Esc 取消選取。","Ctrl＋↑／↓ 或拖曳圓點移動列，已選取的多列會一起移動。","Page Up／Down 跳到同一父節點下的第一列／最後一列。","Alt＋←／→ 或點三角形收合、展開子列。","Ctrl／⌘＋C、X、V 可複製、剪下、貼上選取列。"])list.append(el("li","",hint));
 list.append(el("li","","貼上已複製或剪下的列時，將游標放在列首或列尾，分別插在該列之前或之後。"),el("li","","Ctrl＋Z（Mac 為 ⌘＋Z）逐步復原目前筆記頁的文字與列操作。"));
 help.append(el("h2","","筆記操作說明"),list,btn("關閉","btn",()=>help.close()));
 header.append(title,info);main.append(header,body);root.append(nav,main,editorDialog,help);
 function cardDialog(kind,record){
  const shelf=bookId,isBook=kind==="books",listKey=isBook?"notebooks":"notes";
  name.value=record?.title||"";icon.value=record?.icon||(isBook?"▤":"▧");color.value=record?.color||"#e1e5e7";
  saveCard=values=>write(j=>{
   if(record){const item=j[listKey].find(x=>x.id===record.id);if(item)Object.assign(item,values);return}
   const id=crypto.randomUUID(),siblings=isBook?j.notebooks:j.notes.filter(n=>n.bookId===shelf);
   const order=Math.max(-1,...siblings.map(x=>x.order))+1;
   if(isBook){j.notebooks.push({id,order,...values});bookId=id;pageId=""}
   else if(j.notebooks.some(b=>b.id===shelf)){j.notes.push({id,order,bookId:shelf,rows:[],...values});pageId=id}
   anchor=head=null;
  });editorDialog.showModal();name.focus();name.select();
 }
 function clearMark(){if(marker)marker.classList.remove("drop-above","drop-below");marker=null}
 function position(target,e){clearMark();const rect=target.getBoundingClientRect(),after=e.clientY>=rect.top+rect.height/2;target.classList.add(after?"drop-below":"drop-above");marker=target;return Number(target.dataset.index)+(after?1:0)}
 function wireDrop(target,kind,move){
  target.ondragover=e=>{if(drag?.kind!==kind)return;e.preventDefault();e.dataTransfer.dropEffect="move";position(target,e)};
  target.ondragleave=e=>{if(!target.contains(e.relatedTarget))clearMark()};
  target.ondrop=e=>{if(drag?.kind!==kind)return;e.preventDefault();const at=position(target,e),source=drag.index;stopDrag();move(source,at)};
 }
 function stopDrag(){clearMark();drag=null}
 function draggable(handle,kind,i,begin,move){
  handle.draggable=true;
  handle.ondragstart=e=>{begin();drag={kind,index:i};e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",handle.getAttribute("aria-label")||kind)};
  handle.ondragend=stopDrag;
  let touch=null;
  handle.onpointerdown=e=>{if(e.pointerType!=="touch")return;touch={x:e.clientX,y:e.clientY};handle.setPointerCapture(e.pointerId)};
  handle.onpointermove=e=>{
   if(!touch)return;if(!drag&&Math.hypot(e.clientX-touch.x,e.clientY-touch.y)<8)return;
   if(!drag){begin();drag={kind,index:i}}
   const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-drop="'+kind+'"]');
   if(target)position(target,e);else clearMark();
  };
  handle.onpointercancel=()=>{touch=null;stopDrag()};
  handle.onpointerup=e=>{if(!touch)return;touch=null;if(!drag)return;const at=marker?position(marker,e):null;stopDrag();if(at!==null)move(i,at)};
 }
 function column(kind,heading){
  const wrap=el("section","note-column"),list=el("div","note-cards");
  list.setAttribute("aria-label",heading);const add=btn("＋ 新增"+heading,"note-add",()=>cardDialog(kind));
  wrap.append(el("h2","",heading),list,add);nav.append(wrap);return {list,add,kind};
 }
 const books=column("books","筆記本"),pages=column("pages","筆記頁");
 function drawCards(col,records,current){
  const {list,kind}=col,isBook=kind==="books",scroll=list.scrollTop;
  list.replaceChildren();
  function reorder(from,to){
   if(from===to||from+1===to)return;
   const ids=records.map(n=>n.id);ids.splice(to>from?to-1:to,0,ids.splice(from,1)[0]);
   write(j=>{for(const item of isBook?j.notebooks:j.notes){const rank=ids.indexOf(item.id);if(rank>=0)item.order=rank}});render();
  }
  records.forEach((r,i)=>{
   const card=el("div","note-card");card.dataset.index=i;card.dataset.drop=kind;
   const choose=btn("","note-card-name",()=>{
    if(isBook){if(bookId!==r.id)pageId="";bookId=r.id}else pageId=r.id;
    anchor=head=null;render();if(isBook)books.list.querySelector('[aria-current="true"]')?.focus();else focus(0);
   });
   choose.append(el("span","card-icon",r.icon||(isBook?"▤":"▧")),el("span","card-caption",r.title));choose.title=r.title;choose.style.color=r.color||"";choose.setAttribute("aria-current",String(current===r.id));
   const edit=btn("✎","card-edit",()=>cardDialog(kind,r));edit.setAttribute("aria-label","編輯 "+r.title);
   card.append(choose,edit);list.append(card);wireDrop(card,kind,reorder);
   draggable(choose,kind,i,()=>{},reorder);
  });
  list.scrollTop=scroll;
 }
 const page=()=>data().notes.find(n=>n.id===pageId);
 const histories=new Map();
 const historyKey=()=>JSON.stringify([fileId(),pageId]);
 const sameRow=(a,b)=>a.type===b.type&&a.text===b.text&&a.depth===b.depth&&a.collapsed===b.collapsed;
 const sameRows=(a,b)=>a.length===b.length&&a.every((row,i)=>sameRow(row,b[i]));
 function bookmark(field=document.activeElement){
  return {index:Number(field?.closest(".note-row")?.dataset.index??head??0),start:field?.selectionStart,end:field?.selectionEnd,anchor,head};
 }
 function edit(fn,caret=bookmark(),group=null){
  const key=historyKey();
  write(j=>{
   const n=j.notes.find(n=>n.id===pageId);if(!n)return;
   let history=histories.get(key);
   if(!history||!sameRows(history.current,n.rows))history={current:n.rows.map(r=>({...r})),steps:[]};
   const before=history.current;fn(n);
   let first=0,tail=0,min=Math.min(before.length,n.rows.length);
   while(first<min&&sameRow(before[first],n.rows[first]))first++;
   if(first===before.length&&first===n.rows.length)return;
   while(tail<min-first&&sameRow(before[before.length-1-tail],n.rows[n.rows.length-1-tail]))tail++;
   history.steps.push({first,remove:n.rows.length-first-tail,restore:before.slice(first,before.length-tail),caret,group});
   history.current=n.rows.map(r=>({...r}));histories.set(key,history);
  });
 }
 function undo(){
  const key=historyKey(),history=histories.get(key);if(!history?.steps.length)return;
  if(!sameRows(history.current,page()?.rows||[])){histories.delete(key);return}
  let step;
  write(j=>{
   const n=j.notes.find(n=>n.id===pageId);
   do{step=history.steps.pop();n.rows.splice(step.first,step.remove,...step.restore)}
   while(step.group&&history.steps.at(-1)?.group===step.group);
   history.current=n.rows.map(r=>({...r}));
  });
  const caret=step.caret;anchor=caret.anchor;head=caret.head;render();
  const index=visible.includes(caret.index)?caret.index:visible[0];focus(index,caret.start);
  if(caret.end!=null)document.activeElement?.setSelectionRange?.(caret.start,caret.end);
 }
 body.addEventListener("keydown",e=>{
  if(!e.isComposing&&e.keyCode!==229&&(e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==="z"){e.preventDefault();undo()}
 });
 function range(i){return anchor===null?[i,i]:[Math.min(anchor,head),Math.max(anchor,head)]}
 function focus(i,pos){const field=body.querySelector('[data-index="'+i+'"] [data-editor]');if(!field)return;field.focus();if(pos!==undefined&&field.setSelectionRange)field.setSelectionRange(pos,pos);field.scrollIntoView({block:"nearest"})}
 function mark(){for(const n of body.children){const i=+n.dataset.index,[a,b]=range(i);const selected=anchor!==null&&i>=a&&i<=b;n.classList.toggle("selected",selected);n.draggable=selected}}
 function modify(fn,i,pos){
  edit(n=>{if(!n.rows.length)n.rows=[textRow()];fn(n.rows);n.rows=normalize(n.rows)});
  anchor=head=null;render();focus(visible.includes(i)?i:visible.filter(v=>v<=i).at(-1)??0,pos);
 }
 function extent(rows,i){const [a,end]=range(i);return [a,Math.max(end,endOfBranch(rows,end)-1)]}
 function moveRows(i,to,targetDepth){
  const rows=page().rows,[a,b]=extent(rows,i);if(to>=a&&to<=b+1)return;
  const at=to>b?to-(b-a+1):to;
  const selection=anchor===null?null:[at+anchor-a,at+head-a];
  modify(rs=>{
   const block=rs.splice(a,b-a+1),maxDepth=at?rs[at-1].depth+1:0;
   const delta=Math.min(targetDepth??block[0].depth,maxDepth)-block[0].depth;
   block.forEach(row=>row.depth=Math.max(0,row.depth+delta));rs.splice(at,0,...block);
  },at);
  if(selection){[anchor,head]=selection;mark();focus(head)}
 }
 function render(){
  const j=data(),shelves=ordered(j.notebooks);if(!shelves.some(n=>n.id===bookId))bookId=shelves[0]?.id||"";
  const entries=ordered(j.notes.filter(n=>n.bookId===bookId));if(!entries.some(n=>n.id===pageId)){pageId=entries[0]?.id||"";anchor=head=null}
  drawCards(books,shelves,bookId);drawCards(pages,entries,pageId);pages.add.disabled=!bookId;
  const n=entries.find(n=>n.id===pageId);main.hidden=!n;body.replaceChildren();visible=[];if(!n)return;
  title.textContent=n.title;
  const rows=n.rows.length?n.rows:[textRow()],actions=new Map(j.bullets.filter(b=>!b.deletedAt).map(b=>[b.id,b]));
  let hiddenDepth=Infinity;
  rows.forEach((r,i)=>{
   if(r.depth>hiddenDepth)return;hiddenDepth=r.collapsed?r.depth:Infinity;visible.push(i);
   const parent=rows[i+1]?.depth>r.depth,line=el("div","note-row");line.dataset.index=i;line.dataset.drop="rows";line.style.setProperty("--depth",r.depth);line.classList.toggle("parent",parent);
   const guides=el("span","tree-guides");line.append(guides);
   const fold=btn(parent?(r.collapsed?"▸":"▾"):"","tree-fold",()=>toggle(!r.collapsed));fold.tabIndex=-1;fold.disabled=!parent;if(parent){fold.setAttribute("aria-expanded",String(!r.collapsed));fold.setAttribute("aria-label",r.collapsed?"展開子列":"收合子列")}
   function toggle(closed){if(parent)modify(rs=>{rs[i].collapsed=closed},i)}
   const dot=btn("●","tree-dot",e=>{if(e.shiftKey&&anchor!==null)head=i;else anchor=head=i;mark();focus(i)});dot.tabIndex=-1;dot.setAttribute("aria-label","選取或拖曳列");line.classList.toggle("folded",Boolean(parent&&r.collapsed));
   function dropRows(from,to){
    const after=to===i+1;
    if(after&&r.collapsed)to=endOfBranch(rows,i);
    moveRows(from,to,after&&parent&&!r.collapsed?r.depth+1:r.depth);
   }
   draggable(dot,"rows",i,()=>{const [a,b]=range(i);if(anchor===null||i<a||i>b)anchor=head=i;mark()},(from,to)=>{
    const target=rows[to-1];moveRows(from,target?.collapsed?endOfBranch(rows,to-1):to);
   });wireDrop(line,"rows",dropRows);
   line.ondragstart=e=>{
    if(e.target===dot||anchor===null)return;
    const [a,b]=range(i);if(i<a||i>b)return;
    drag={kind:"rows",index:i};e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",r.text);
   };line.ondragend=stopDrag;
   let field;
   if(r.type==="text"){
    field=el("textarea","tree-text");field.rows=1;field.value=r.text;field.placeholder=rows.length===1?"輸入文字…":"";
    let beforeInput=null,composition=null;
    field.oncompositionstart=()=>{composition={}};
    field.oncompositionend=()=>{composition=null};
    field.onbeforeinput=e=>{
     if(e.inputType==="historyUndo"&&e.cancelable){e.preventDefault();undo();return}
     beforeInput=bookmark(field);
    };
    field.oninput=()=>{edit(n=>{if(!n.rows.length)n.rows=[textRow()];n.rows[i].text=field.value},beforeInput??bookmark(field),composition);beforeInput=null;r.text=field.value;anchor=head=null;mark()};
   }else if(r.type==="action"){
    const a=actions.get(r.text);field=btn(a?(a.status==="done"?"✓ ":"☐ ")+(a.action||"Action"):"已移除的 Action","tree-action",()=>{if(a)openAction(r.text)});
   }else{
    const url=r.type==="image"?imageURL(r.text):httpURL(r.text);field=el("a","tree-link");if(url){field.href=url;field.target="_blank";field.rel="noopener noreferrer"}
    if(r.type==="image"&&url){const img=el("img");img.alt="筆記圖片";img.src=url;field.append(img)}else field.textContent=r.text;
   }
   field.dataset.editor="";field.tabIndex=0;field.setAttribute("aria-label","第 "+(i+1)+" 列"+(r.type==="text"?"":"，"+(field.textContent||"圖片")));
   field.onpointerdown=e=>{const [a,b]=range(i);if(e.shiftKey){e.preventDefault();anchor??=i;head=i;focus(i)}else if(anchor===null||i<a||i>b)anchor=head=null;mark()};
   line.append(fold,dot,field);body.append(line);
   line.onkeydown=e=>{
    if(e.isComposing||e.keyCode===229)return;
    const key=e.key,up=key==="ArrowUp",down=key==="ArrowDown",idx=visible.indexOf(i),step=down?1:-1;
    const adjacent=visible[idx+step],[a,b]=range(i);
    if(key==="Escape"){if(anchor!==null){e.preventDefault();anchor=head=null;mark()}return}
    if((up||down)&&e.shiftKey){e.preventDefault();if(anchor===null)anchor=head=i;else head=adjacent??i;focus(head);mark();return}
    if((up||down)&&e.ctrlKey){e.preventDefault();const [first,last]=extent(rows,i);
     if(up){const before=visible.filter(v=>v<first).at(-1);if(before!==undefined)moveRows(i,before)}
     else if(last+1<rows.length)moveRows(i,endOfBranch(rows,last+1));return}
    if(key==="Tab"){e.preventDefault();const [first,last]=extent(rows,i),delta=e.shiftKey?-1:1;if(delta<0?!rows[first].depth:!first||rows[first].depth>rows[first-1].depth)return;
     modify(rs=>{if(delta>0)rs[first-1].collapsed=false;for(let k=first;k<=last;k++)rs[k].depth+=delta},first);return}
    if(key==="PageUp"||key==="PageDown"){e.preventDefault();const dir=key==="PageUp"?-1:1;let dest=i;
     for(let v=idx+dir;v>=0&&v<visible.length;v+=dir){const k=visible[v];if(rows[k].depth<r.depth)break;if(rows[k].depth===r.depth)dest=k}
     anchor=head=null;mark();focus(dest,0);return}
    if(e.altKey&&["ArrowRight","ArrowLeft"].includes(key)){e.preventDefault();toggle(key==="ArrowLeft");return}
    if(anchor!==null&&["Backspace","Delete"].includes(key)){e.preventDefault();const last=rows[b].collapsed?endOfBranch(rows,b)-1:b;modify(rs=>rs.splice(a,last-a+1),a,0);return}
    const start=field.selectionStart??0,end=field.selectionEnd??0;
    if(key==="Enter"&&!e.ctrlKey&&!e.metaKey){e.preventDefault();modify(rs=>{const tail=r.type==="text"?field.value.slice(end):"";if(r.type==="text")rs[i].text=field.value.slice(0,start);rs[i].collapsed=false;rs.splice(i+1,0,textRow(tail,parent?rows[i+1].depth:r.depth))},i+1,0);return}
    if(r.type==="text"&&start===end&&((key==="Backspace"&&start===0)||(key==="Delete"&&end===field.value.length))){
     e.preventDefault();const right=key==="Delete"?visible[idx+1]:i,left=key==="Delete"?i:visible[idx-1];
     if(right===undefined)return;
     if(rows[right].type!=="text"){modify(rs=>rs.splice(right,1),left,end);return}
     const value=rows[right].text;
     if(value&&(left===undefined||left!==right-1||rows[left].type!=="text"))return;
     const pos=rows[left]?.text.length??0;
     modify(rs=>{if(value)rs[left].text+=value;rs.splice(right,1)},left??0,pos);return}
    if(r.type!=="text"&&["Backspace","Delete"].includes(key)){e.preventDefault();modify(rs=>rs.splice(i,1),i);return}
    if((up||down)&&!e.altKey&&!e.metaKey){e.preventDefault();if(adjacent!==undefined){const nearEnd=r.type==="text"&&start+end>field.value.length;anchor=head=null;mark();focus(adjacent,nearEnd?rows[adjacent].text.length:0)}}
   };
  });mark();
 }
 function copy(e,cut){
  if(anchor===null)return;const rows=page().rows,[a,b]=range(0),last=rows[b]?.collapsed?endOfBranch(rows,b)-1:b,part=rows.slice(a,last+1);if(!part.length)return;
  const min=Math.min(...part.map(r=>r.depth)),block=part.map(r=>({...r,depth:r.depth-min}));e.preventDefault();
  e.clipboardData.setData(rowMime,JSON.stringify(block));const actions=new Map(data().bullets.map(b=>[b.id,b.action]));
  e.clipboardData.setData("text/plain",block.map(r=>"  ".repeat(r.depth)+"- "+(r.type==="action"?actions.get(r.text)||"Action":r.text)).join("\n"));
  if(cut)modify(rs=>rs.splice(a,last-a+1),a,0);
 }
 body.oncopy=e=>copy(e,false);body.oncut=e=>copy(e,true);
 body.onpaste=e=>{
  const line=e.target.closest(".note-row");if(!line)return;
  const i=+line.dataset.index,clip=e.clipboardData,plain=clip.getData("text/plain"),row=page().rows[i]||textRow(),[a,b]=range(i);
  const replace=anchor!==null||!row.text,at=replace?a:i+1;
  function insert(block){modify(rs=>rs.splice(at,replace?b-a+1:0,...block.map(r=>({...r,depth:r.depth+row.depth}))),at+block.length-1)}
  let copiedRows;
  try{copiedRows=JSON.parse(clip.getData(rowMime))}catch{}
  if(Array.isArray(copiedRows)&&copiedRows.length&&copiedRows.every(r=>r&&typeof r.text==="string")){
   e.preventDefault();
   const field=e.target,start=field.selectionStart,end=field.selectionEnd;
   if(field.tagName!=="TEXTAREA"||start!==end||(start!==0&&start!==field.value.length))return;
   const index=start===0?i:i+1,emptyPage=!page().rows.length;
   const block=normalize(copiedRows).map(r=>({...r,depth:r.depth+row.depth}));
   modify(rs=>rs.splice(index,emptyPage?1:0,...block),index+block.length-1);
   return;
  }
  const file=[...(clip.files||[])].find(f=>/^image\/(png|jpeg|gif|webp|avif)$/i.test(f.type));
  if(file){e.preventDefault();const id=pageId,before=JSON.stringify(page().rows),reader=new FileReader();
   reader.onload=()=>{if(pageId===id&&JSON.stringify(page()?.rows)===before)insert([{type:"image",text:reader.result,depth:0}])};reader.readAsDataURL(file);return}
  const template=el("template");template.innerHTML=clip.getData("text/html")||"";
  const fragment=template.content,img=fragment.querySelector("img"),link=fragment.querySelector("a[href]");
  const onlyImage=img&&!fragment.textContent.trim()&&fragment.querySelectorAll("img").length===1;
  const onlyLink=link&&fragment.textContent.trim()===link.textContent.trim()&&fragment.querySelectorAll("a[href]").length===1;
  const candidate=plain.trim(),action=clip.getData(actionMime)||candidate.replace(/^drive-memo:action\//,"");
  const url=httpURL(clip.getData("text/uri-list").split(/\r?\n/).find(s=>s&&!s.startsWith("#"))||candidate)||(onlyLink?httpURL(link.getAttribute("href")):"");
  const picture=imageURL((onlyImage&&img.getAttribute("src"))||url||candidate);
  const type=data().bullets.some(b=>b.id===action&&!b.deletedAt)?"action":picture&&(onlyImage||/^data:image\//i.test(picture)||/\.(png|jpe?g|gif|webp|avif|svg)(?:[?#]|$)/i.test(picture))?"image":url?"link":"";
  if(type){e.preventDefault();insert([{type,text:type==="action"?action:type==="image"?picture:url,depth:0}]);return}
  if(!plain||(!plain.includes("\n")&&anchor===null&&row.type==="text"))return;
  e.preventDefault();const block=normalize(plain.replace(/\r/g,"").split("\n").map(s=>{const m=s.match(/^(\s*)(?:[-*•] )?(.*)$/);return textRow(m[2],Math.floor(m[1].replace(/\t/g,"  ").length/2))}));
  if(anchor===null&&row.type==="text"){const f=e.target;block[0].text=f.value.slice(0,f.selectionStart)+block[0].text;const last=block.at(-1),pos=last.text.length;last.text+=f.value.slice(f.selectionEnd);
   modify(rs=>rs.splice(i,1,...block.map(r=>({...r,depth:r.depth+row.depth}))),i+block.length-1,pos);
  }else insert(block);
 };
 return {render};
}
global.DriveMemoNotes={create};
})(window);
