(function(global){
"use strict";

const FORMAT_VERSION=1;
const UI_STATE_MARKER="DRIVE_MEMO_UI_STATE";
const UI_STATE_RE=/<!-- DRIVE_MEMO_UI_STATE\r?\n([\s\S]*?)\r?\n-->/;
const DEFAULT_DEBUG_STATE={version:1,checked:false,switchOn:false,priority:"normal",stage:"todo",progress:25,note:"",updatedAt:""};

function normalizeDebugState(value={}){
 const priority=["low","normal","high"].includes(value.priority)?value.priority:"normal";
 const stage=["todo","doing","waiting","done"].includes(value.stage)?value.stage:"todo";
 const progress=Math.max(0,Math.min(100,Number(value.progress)||0));
 return{version:1,checked:Boolean(value.checked),switchOn:Boolean(value.switchOn),priority,stage,progress,note:String(value.note||"").slice(0,80),updatedAt:String(value.updatedAt||"")}
}

function parse(markdown=""){
 const raw=String(markdown||""),match=raw.match(UI_STATE_RE);let debugState={...DEFAULT_DEBUG_STATE};
 if(match){try{debugState=normalizeDebugState(JSON.parse(match[1]))}catch(error){console.warn("互動狀態資料無法解析",error)}}
 return{formatVersion:FORMAT_VERSION,body:raw.replace(UI_STATE_RE,"").trimEnd(),debugState}
}

function serialize(documentModel){
 const body=String(documentModel?.body||"").trimEnd(),debugState=normalizeDebugState(documentModel?.debugState);
 const block=`<!-- ${UI_STATE_MARKER}\n${JSON.stringify(debugState,null,2)}\n-->`;
 return body?`${body}\n\n${block}`:block
}

function updateDebugState(markdown,patch){
 const model=parse(markdown);model.debugState=normalizeDebugState({...model.debugState,...patch,updatedAt:new Date().toISOString()});return serialize(model)
}

function toViewModel(markdown){
 const model=parse(markdown);
 return{formatVersion:model.formatVersion,categories:[{id:"memo",label:"筆記內容",items:[{id:"main",type:"markdown",content:model.body}]}],debugState:model.debugState}
}

global.DriveMemoContent=Object.freeze({FORMAT_VERSION,UI_STATE_MARKER,DEFAULT_DEBUG_STATE:Object.freeze({...DEFAULT_DEBUG_STATE}),normalizeDebugState,parse,serialize,updateDebugState,toViewModel});
})(window);
