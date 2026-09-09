(function(global){
"use strict";
function create({onIdentity=()=>{},onConnected=()=>{},onReady=()=>{},onStatus=()=>{}}={}){
 let token=null,expires=0,pending=null,popup=null;
 async function getToken(force=false){
  if(pending)return pending;
  if(!force&&token&&expires>Date.now()+60000)return token;
  pending=(async()=>{let response;try{response=await fetch("/auth/token",{method:"POST",credentials:"same-origin",headers:{"X-Drive-Memo":"1",...(force?{"X-Drive-Memo-Refresh":"1"}:{})},cache:"no-store"})}catch{throw Error("暫時無法連接同步服務，請稍後再試")}
   if(response.status===401){token=null;expires=0;onConnected(false);throw Error("AUTH_EXPIRED")}
   if(!response.ok)throw Error("同步服務暫時無法續期，請稍後再試");
   const value=await response.json();token=value.access_token;expires=Date.now()+Number(value.expires_in)*1000;onIdentity(value.email);onConnected(true);return token;
  })();try{return await pending}finally{pending=null}
 }
 async function initialize(){try{await getToken();return true}catch(error){onStatus(error.message==="AUTH_EXPIRED"?"請首次連接 Google，之後將自動續期":error.message,"");return false}}
 function login(){if(popup&&!popup.closed){popup.focus();return}popup=global.open("/auth/login","drive-memo-google","popup,width=520,height=680");if(!popup)onStatus("請允許登入視窗，然後再點登入","err")}
 global.addEventListener("message",async event=>{if(event.origin!==global.location.origin||event.source!==popup||event.data?.type!=="drive-memo-auth")return;popup=null;try{token=null;await getToken();await onReady()}catch(error){onStatus(error.message==="AUTH_EXPIRED"?"Google 授權已失效，請重新連接":error.message,"err")}});
 async function logout(){const response=await fetch("/auth/logout",{method:"POST",credentials:"same-origin",headers:{"X-Drive-Memo":"1"}});if(!response.ok)throw Error("登出失敗，請稍後再試");token=null;expires=0;onConnected(false)}
 return{getToken,initialize,login,logout};
}
global.DriveMemoBackendAuth={create};
})(window);
