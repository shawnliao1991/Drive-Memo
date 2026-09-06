(function(global){
"use strict";
function create({root,content,getText,mutate,renderBullet,onRange}){
 let month=content.localDateKey().slice(0,7),selectedDay='',dragId='',dropDate='',pointer=null;
 const calendar=root.querySelector('#journalCalendar'),hint=root.querySelector('#dragHint');
 function renderCalendar(){const [y,m]=month.split('-').map(Number),first=new Date(y,m-1,1,12).getDay(),days=new Date(y,m,0,12).getDate(),counts=content.getMonthCounts(getText(),month);let cells='';
 for(let i=0;i<first;i++)cells+='<span></span>';
 for(let i=1;i<=days;i++){const date=month+'-'+String(i).padStart(2,'0'),c=counts[date]||{},counters=[...content.PRIORITIES,"pending"].map(p=>Array.from({length:c[p]||0},()=>`<span class="calendar-dot ${p}" aria-hidden="true"></span>`).join("")).join('');cells+=`<button type="button" class="month-day ${date===content.localDateKey()?'is-today':''}" data-month-date="${date}" data-drop-date="${date}" aria-label="${date}，${Object.values(c).reduce((a,b)=>a+b,0)} 個 Action"><strong>${i}</strong><span class="day-counts">${counters}</span></button>`}
 calendar.innerHTML=`<div class="calendar-head"><button class="btn" data-month-step="-1" aria-label="上個月">‹</button><strong>${y} 年 ${m} 月</strong><button class="btn" data-month-step="1" aria-label="下個月">›</button></div><div class="month-grid">${['日','一','二','三','四','五','六'].map(n=>`<span class="weekday">${n}</span>`).join('')}${cells}</div><div id="calendarActions"></div>`;
 if(selectedDay)showDay(selectedDay);
 }
 function showDay(date){selectedDay=date;const day=content.getAgenda(getText(),date,2)[0];calendar.querySelector('#calendarActions').innerHTML=`<section class="calendar-actions" data-drop-date="${date}"><h3>${date}</h3>${[...day.todo,...day.done].map(renderBullet).join('')||'<p class="muted">沒有 Action</p>'}</section>`}
 function clearPreview(){root.querySelectorAll('.drop-target').forEach(n=>n.classList.remove('drop-target'));root.querySelectorAll('.drop-preview').forEach(n=>n.remove());hint.classList.add('hidden');dropDate=''}
 function preview(target){const zone=target?.closest('[data-drop-date]');if(!zone){clearPreview();return}const date=zone.dataset.dropDate;if(date===dropDate&&zone.classList.contains('drop-target'))return;clearPreview();dropDate=date;zone.classList.add('drop-target');hint.textContent='放開移到 '+date;hint.classList.remove('hidden');
 const source=content.getBullet(getText(),dragId);if(!source)return;const section=zone.matches('.agenda-day')?zone:null;if(!section)return;
 const group=source.status==='done'?'done':'todo',day=content.getAgenda(content.updateBullet(getText(),dragId,{date}),date,2)[0],ordered=day[group],index=ordered.findIndex(b=>b.id===dragId),after=ordered.slice(index+1).map(b=>section.querySelector(`article[data-id="${CSS.escape(b.id)}"]`)).find(Boolean),marker=document.createElement('div');marker.className='drop-preview';marker.textContent='放開後：'+(source.action||source.title);const list=section.querySelector(group==='done'?'.agenda-done .bullet-list':'.agenda-section .bullet-list');if(list){if(group==='done')list.closest('details').open=true;list.querySelector('.empty')?.classList.add('hidden');if(after)after.before(marker);else list.append(marker)}else section.append(marker);
 }
 function finish(commit){const id=dragId,date=dropDate;clearPreview();root.querySelectorAll('.dragging').forEach(n=>n.classList.remove('dragging'));root.querySelectorAll('.empty').forEach(n=>n.classList.remove('hidden'));dragId='';pointer=null;if(commit&&id&&date){mutate(text=>content.updateBullet(text,id,{date}));renderCalendar()}}
 root.addEventListener('dragstart',e=>{const source=e.target.closest('[data-drag-id]');if(!source)return;dragId=source.dataset.dragId;source.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId)});
 root.addEventListener('dragover',e=>{if(!dragId)return;e.preventDefault();e.dataTransfer.dropEffect='move';preview(e.target);if(e.clientY<80)scrollBy(0,-18);if(e.clientY>innerHeight-80)scrollBy(0,18)});
 root.addEventListener('drop',e=>{if(!dragId)return;e.preventDefault();preview(e.target);finish(true)});root.addEventListener('dragend',()=>finish(false));
 root.addEventListener('pointerdown',e=>{const handle=e.target.closest('.action-drag-handle');if(!handle||e.button!==0)return;e.preventDefault();dragId=handle.closest('[data-drag-id]').dataset.dragId;pointer=e.pointerId;handle.setPointerCapture(pointer)});
 root.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;e.preventDefault();preview(document.elementFromPoint(e.clientX,e.clientY));if(e.clientY<80)scrollBy(0,-18);if(e.clientY>innerHeight-80)scrollBy(0,18)});
 root.addEventListener('pointerup',e=>{if(pointer===e.pointerId){preview(document.elementFromPoint(e.clientX,e.clientY));finish(true)}});root.addEventListener('pointercancel',()=>finish(false));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dragId)finish(false)});
 root.addEventListener('click',e=>{if(e.target.closest('.action-drag-handle'))e.preventDefault()});
 root.addEventListener('click',e=>{const step=e.target.closest('[data-month-step]'),day=e.target.closest('[data-month-date]'),range=e.target.closest('[data-agenda-range]');if(step){const [y,m]=month.split('-').map(Number);month=content.localDateKey(new Date(y,m-1+Number(step.dataset.monthStep),1,12)).slice(0,7);selectedDay='';renderCalendar()}if(day)showDay(day.dataset.monthDate);if(range)onRange(range.dataset.agendaRange)});
 return{renderCalendar};
}
global.DriveMemoJournal={create};
})(window);
