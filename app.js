(function(){
"use strict";
const files=["content.js","sync.js","ui.js"],base=new URL(".",document.currentScript.src);
function load(index){if(index>=files.length)return;const script=document.createElement("script");script.src=new URL(`${files[index]}?v=20260905-10`,base).href;script.onload=()=>load(index+1);script.onerror=()=>console.error(`無法載入 ${files[index]}`);document.head.appendChild(script)}
load(0);
})();
