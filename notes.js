(function(global){
"use strict";
const clipboardType="application/x-drive-memo-rows";
const makeRow=(text="",depth=0)=>({text,depth,type:"text"});
function normalize(rows){
 let previous=-1;
 return rows.map(row=>{
  previous=Math.min(previous+1,Math.max(0,Math.floor(Number(row.depth)||0)));
  return {type:["text","link","image","action"].includes(row.type)?row.type:"text",text:String(row.text??""),depth:previous};
 });
}
function create(root,read,write,openAction){
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el};
 function button(label,fn){const el=node("button",label);el.type="button";el.onclick=fn;return el}
 let active="",anchor=null,head=null,drag=null;
 const data=()=>read().journal;
 const notes=()=>data().notes;
 const book=()=>notes().find(n=>n.id===active);
 function change(fn){write(j=>fn(j.notes,j));}
 function edit(fn){change(list=>{const n=list.find(n=>n.id===active);if(n)fn(n)});}
 const nav=node("aside"),main=node("section"),directory=node("div"),body=node("div"),heading=node("input");
 heading.setAttribute("aria-label","筆記名稱");
 function addNote(folder){
  const title=prompt("筆記名稱")?.trim();if(!title)return;
  active=crypto.randomUUID();change(list=>list.push({id:active,title,folder,rows:[]}));anchor=head=null;render();focus(0);
 }
 nav.append(node("h2","筆記"),button("新增分類與筆記",()=>{const f=prompt("分類名稱")?.trim();if(f)addNote(f)}),directory);
 heading.onchange=()=>{const title=heading.value.trim();if(title)edit(n=>n.title=title);render()};
 const help=node("details");help.append(node("summary","鍵盤操作"),node("p","Enter 分行，Backspace 合併文字或刪除空列。Alt＋左右調整階層，Alt＋上下移動列。Shift＋上下選取連續列，Esc 取消選取。Ctrl／⌘＋C、X、V 複製、剪下、貼上。Tab 切換到列類型與目錄。"));
 main.append(heading,help,body);root.append(nav,main);
 const editors=()=>[...body.querySelectorAll("[data-editor]")];
 function focus(i,pos){const el=editors()[i];if(!el)return;el.focus();if(el.setSelectionRange&&pos!==undefined)el.setSelectionRange(pos,pos);el.scrollIntoView({block:"nearest"})}
 function range(i){return anchor===null?[i,i]:[Math.min(anchor,head),Math.max(anchor,head)]}
 function mark(){[...body.children].forEach((el,i)=>el.classList.toggle("selected",anchor!==null&&i>=Math.min(anchor,head)&&i<=Math.max(anchor,head)))}
 function modify(fn,i,pos){edit(n=>{if(!n.rows.length)n.rows.push(makeRow());fn(n.rows);n.rows=normalize(n.rows)});anchor=head=null;render();focus(Math.max(0,Math.min(i,editors().length-1)),pos)}
 function move(i,dest){
  const [a,b]=range(i);if(dest>=a&&dest<=b+1)return;
  const at=dest>b?dest-(b-a+1):dest;
  modify(rows=>{const block=rows.splice(a,b-a+1);rows.splice(at,0,...block)},at);
 }
 function safeURL(text){try{const u=new URL(text);return ["http:","https:"].includes(u.protocol)?u.href:""}catch{return ""}}
 function render(){
  const j=data(),list=j.notes;
  if(!list.some(n=>n.id===active)){active=list[0]?.id||"";anchor=head=null}
  directory.replaceChildren();
  for(const folder of new Set(list.map(n=>n.folder))){
   const group=node("section");group.append(node("h3",folder),button("＋ 筆記",()=>addNote(folder)));
   for(const n of list.filter(n=>n.folder===folder)){const b=button(n.title,()=>{active=n.id;anchor=head=null;render();focus(0)});b.setAttribute("aria-current",String(n.id===active));group.append(b)}
   directory.append(group);
  }
  const n=list.find(n=>n.id===active);main.hidden=!n;body.replaceChildren();if(!n)return;
  heading.value=n.title;
  const rows=n.rows.length?n.rows:[makeRow()],actions=j.bullets.filter(b=>!b.deletedAt&&b.status!=="migrated");
  rows.forEach((r,i)=>{
   const line=node("div");line.className="note-row";line.dataset.index=i;line.style.setProperty("--depth",r.depth);
   const handle=button("⋮⋮",e=>{if(e.shiftKey&&anchor!==null)head=i;else anchor=head=i;mark();focus(i)});handle.title="選取或拖曳列";handle.setAttribute("aria-label","選取或拖曳第 "+(i+1)+" 列");handle.draggable=true;
   handle.ondragstart=e=>{if(anchor===null||i<range(i)[0]||i>range(i)[1])anchor=head=i;drag=i;e.dataTransfer.setData("text/plain",r.text);mark()};handle.ondragend=()=>drag=null;
   handle.style.touchAction="none";
   handle.onpointerdown=e=>{if(e.pointerType==="touch"){handle.setPointerCapture(e.pointerId)}};
   handle.onpointerup=e=>{
    if(e.pointerType!=="touch")return;
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest(".note-row");
    if(!target||target===line||target.parentNode!==body)return;
    if(anchor===null||i<range(i)[0]||i>range(i)[1])anchor=head=i;
    const rect=target.getBoundingClientRect();
    move(i,Number(target.dataset.index)+(e.clientY>rect.top+rect.height/2?1:0));
   };
   line.ondragover=e=>{if(drag!==null)e.preventDefault()};line.ondrop=e=>{if(drag===null)return;e.preventDefault();const rect=line.getBoundingClientRect();move(drag,i+(e.clientY>rect.top+rect.height/2?1:0));drag=null};
   const type=node("select");type.setAttribute("aria-label","列類型");
   for(const [v,label] of Object.entries({text:"文字",link:"連結",image:"圖片",action:"Action"}))type.add(new Option(label,v));
   type.value=r.type;type.onchange=()=>modify(rs=>{
    if(type.value==="action"||rs[i].type==="action")rs[i].text="";
    rs[i].type=type.value;
   },i);
   const field=node(r.type==="action"?"select":"textarea");field.dataset.editor="";field.setAttribute("aria-label","第 "+(i+1)+" 列");
   if(r.type==="action"){field.add(new Option("選擇 Action",""));for(const a of actions)field.add(new Option((a.status==="done"?"✓ ":"")+(a.action||"未命名 Action"),a.id));if(r.text&&!actions.some(a=>a.id===r.text))field.add(new Option("原 Action 已移除",r.text))}
   else{field.rows=1;field.placeholder=r.type==="text"?"輸入文字":"https://…"}
   field.value=r.text;line.append(handle,type,field);
   const preview=node("span");line.append(preview);
   function showPreview(){
    preview.replaceChildren();const v=field.value;
    if(r.type==="action"&&actions.some(a=>a.id===v))preview.append(button("開啟",()=>openAction(v)));
    if((r.type==="image"||r.type==="link")&&safeURL(v)){const a=node("a","開啟連結");a.href=safeURL(v);a.target="_blank";a.rel="noopener noreferrer";if(r.type==="image"){const img=node("img");img.alt="筆記圖片";img.loading="lazy";img.src=a.href;a.replaceChildren(img)}preview.append(a)}
   }
   field.oninput=()=>{edit(n=>{if(!n.rows.length)n.rows.push(makeRow());n.rows[i].text=field.value});r.text=field.value;showPreview()};
   field.onpointerdown=e=>{if(e.shiftKey){e.preventDefault();anchor??=i;head=i;mark();focus(i)}else{anchor=head=null;mark()}};
   line.onkeydown=e=>{
    if(e.isComposing||e.keyCode===229)return;
    const [a,b]=range(i),down=e.key==="ArrowDown",up=e.key==="ArrowUp";
    if((e.ctrlKey||e.metaKey)&&e.code==="Space"){e.preventDefault();anchor=head=i;mark();return}
    if(e.key==="Escape"){anchor=head=null;mark();return}
    if(e.altKey&&(up||down)){e.preventDefault();move(i,Math.max(0,Math.min(rows.length,down?b+2:a-1)));return}
    if(e.altKey&&["ArrowRight","ArrowLeft"].includes(e.key)){e.preventDefault();const delta=e.key==="ArrowRight"?1:-1;if(delta>0&&(!a||rows[a].depth>rows[a-1].depth))return;modify(rs=>{for(let k=a;k<=b;k++)rs[k].depth+=delta},i);return}
    if(e.shiftKey&&(up||down)){e.preventDefault();anchor??=i;head=Math.max(0,Math.min(rows.length-1,i+(down?1:-1)));focus(head);mark();return}
    if(e.target!==field)return;
    if(anchor!==null&&["Backspace","Delete"].includes(e.key)){e.preventDefault();modify(rs=>rs.splice(a,b-a+1),a,0);return}
    if(field.tagName==="SELECT"&&!e.altKey&&e.key!=="Enter")return;
    const start=field.selectionStart??r.text.length,end=field.selectionEnd??start;
    if(e.key==="Enter"){e.preventDefault();modify(rs=>{const tail=r.type==="text"?field.value.slice(end):"";if(r.type==="text")rs[i].text=field.value.slice(0,start);rs.splice(i+1,0,makeRow(tail,r.depth))},i+1,0)}
    else if(e.key==="Backspace"&&start===0&&end===0&&(!field.value||i>0&&r.type==="text"&&rows[i-1].type==="text")){e.preventDefault();const pos=i?rows[i-1].text.length:0;modify(rs=>{if(i&&field.value)rs[i-1].text+=field.value;rs.splice(i,1)},i-1,pos)}
    else if((up&&start===0&&i>0)||(down&&end===field.value.length&&i+1<rows.length)){e.preventDefault();focus(i+(down?1:-1),down?0:rows[i-1].text.length)}
   };
   body.append(line);showPreview();
  });mark();
 }
 function copy(e,cut){if(anchor===null)return;const [a,b]=range(0),rows=book().rows.slice(a,b+1);if(!rows.length)return;e.preventDefault();const min=Math.min(...rows.map(r=>r.depth)),block=rows.map(r=>({...r,depth:r.depth-min}));e.clipboardData.setData(clipboardType,JSON.stringify(block));const actions=new Map(data().bullets.map(b=>[b.id,b.action]));e.clipboardData.setData("text/plain",block.map(r=>"  ".repeat(r.depth)+"- "+(r.type==="action"?(actions.get(r.text)||"Action"):r.text)).join("\n"));if(cut)modify(rs=>rs.splice(a,b-a+1),a,0)}
 body.oncopy=e=>copy(e,false);body.oncut=e=>copy(e,true);
 body.onpaste=e=>{
  const line=e.target.closest(".note-row");if(!line)return;const i=Number(line.dataset.index),plain=e.clipboardData.getData("text/plain");let block;
  try{const raw=JSON.parse(e.clipboardData.getData(clipboardType));if(Array.isArray(raw)&&raw.length&&raw.every(r=>r&&typeof r.text==="string"))block=normalize(raw)}catch{}
  if(!block&&!plain.includes("\n")&&anchor===null)return;
  const structured=Boolean(block);
  block??=normalize(plain.replace(/\r/g,"").split("\n").map(s=>{const m=s.match(/^(\s*)(?:[-*•] )?(.*)$/);return makeRow(m[2],Math.floor(m[1].replace(/\t/g,"  ").length/2))}));
  e.preventDefault();const [a,b]=range(i),row=book().rows[i]||makeRow(),replace=anchor!==null||!row.text,at=replace?a:i+1;
  if(!structured&&anchor===null&&e.target.tagName==="TEXTAREA"&&row.type==="text"){
   const field=e.target,last=block.at(-1);
   block[0].text=field.value.slice(0,field.selectionStart)+block[0].text;
   const caret=last.text.length;last.text+=field.value.slice(field.selectionEnd);
   modify(rs=>rs.splice(i,1,...block.map(r=>({...r,depth:r.depth+row.depth}))),i+block.length-1,caret);
   return;
  }
  modify(rs=>rs.splice(at,replace?b-a+1:0,...block.map(r=>({...r,depth:r.depth+row.depth}))),at+block.length-1);
 };
 return {render};
}
global.DriveMemoNotes={create};
})(window);
