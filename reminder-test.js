(function(global){
"use strict";
const SHORTCUT_NAME="Drive Memo 提醒測試";
const pad=value=>String(value).padStart(2,"0");
function localInput(date){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`}
function buildTransfer(title,localTime,now=Date.now()){
 title=String(title||"").trim();
 if(!title||title.length>160)throw Error("請輸入 1 至 160 字的測試標題。");
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localTime||""))throw Error("請選擇完整的提醒日期與時間。");
 const date=new Date(localTime);
 if(!Number.isFinite(date.getTime())||localInput(date)!==localTime)throw Error("這個日期或時間無效，請重新選擇。");
 if(date.getTime()<=now)throw Error("提醒時間已過，請按「五分鐘後」重新設定。");
 const data={title,dueAt:date.toISOString()};
 return {data,url:`shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(JSON.stringify(data))}`};
}
function mount(doc){
 const template=doc.getElementById("reminderTestTemplate"),settings=doc.querySelector("#debugPage .settings");
 if(template&&settings&&!doc.getElementById("reminderTestForm"))settings.after(template.content.cloneNode(true));
 const form=doc.getElementById("reminderTestForm");if(!form)return;
 const title=doc.getElementById("reminderTestTitle"),time=doc.getElementById("reminderTestTime"),status=doc.getElementById("reminderTestStatus"),preview=doc.getElementById("reminderTestPreview");
 const report=text=>{status.textContent=text};
 const read=()=>buildTransfer(title.value,time.value);
 function refresh(){try{preview.textContent=JSON.stringify(read().data,null,2)}catch{preview.textContent="填妥標題與未來時間後，這裡會顯示交給捷徑的資料。"}}
 function resetTime(){time.value=localInput(new Date(Date.now()+5*60000));report("待測試。請先完成下方的一次性捷徑設定。");refresh()}
 form.addEventListener("input",()=>{report("資料已修改，尚未交給捷徑。");refresh()});
 doc.getElementById("reminderTestLater").addEventListener("click",resetTime);
 form.addEventListener("submit",event=>{
  event.preventDefault();
  try{
   const transfer=read();
   report("已嘗試開啟捷徑；網頁無法確認提醒是否建立。請在 iPhone 檢查標題、時間與「緊急」設定。再次按下會再建立一筆測試提醒。");
   const link=doc.createElement("a");link.href=transfer.url;link.target="_blank";link.rel="noopener";link.hidden=true;doc.body.append(link);link.click();link.remove();
  }catch(error){report(error.message)}
 });
 doc.getElementById("reminderTestCopy").addEventListener("click",async()=>{
  try{
   const transfer=read();preview.textContent=JSON.stringify(transfer.data,null,2);
   if(!global.navigator.clipboard?.writeText)throw Error("無法使用剪貼簿，請展開「檢查傳送資料」並手動複製。");
   await global.navigator.clipboard.writeText(preview.textContent);
   report("已複製測試資料，尚未建立提醒。可用於檢查標題與時間。");
  }catch(error){report(error.name==="NotAllowedError"?"無法取得剪貼簿權限，請展開「檢查傳送資料」並手動複製。":error.message)}
 });
 resetTime();
}
global.DriveMemoReminderTest={buildTransfer,localInput,mount};
if(global.document)mount(global.document);
})(typeof window!=="undefined"?window:globalThis);
