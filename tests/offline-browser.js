// Run with Playwright available in NODE_PATH. Uses only a local server and mock Drive responses.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const model={window:{},Date};vm.createContext(model);vm.runInContext(fs.readFileSync('content.js','utf8'),model);const C=model.window.DriveMemoContent,seed=C.addBullet('',{action:'Original',details:'Base note'});let cloud=seed.markdown,version=1,patches=0;
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname,file=path.join(process.cwd(),name==='/'?'index.html':name);if(!file.startsWith(process.cwd()+path.sep)){res.writeHead(403).end();return}try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}}),revoke(){}}}};if(!localStorage.getItem('test-seeded')){localStorage.setItem('test-seeded','1');localStorage.setItem('driveMemoFileId','file');sessionStorage.setItem('driveMemoAccessToken','fake');sessionStorage.setItem('driveMemoTokenExpiresAt',String(Date.now()+3600000))}});
  await context.route('https://**/*',async route=>{
   const req=route.request();if(!req.url().startsWith('https://www.googleapis.com/'))return route.abort();
   if(req.method()==='PATCH'){patches++;cloud=req.postData();version++}
   await route.fulfill({status:200,contentType:req.url().includes('alt=media')?'text/plain':'application/json',body:req.url().includes('alt=media')?cloud:JSON.stringify({id:'file',name:'memo.md',version:String(version)})});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const url='http://127.0.0.1:'+server.address().port+'/';await page.goto(url);
  await page.waitForFunction(()=>document.querySelector('#editor').value.includes('Base note'));
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const buttons=await page.locator('#logoutBtn').boundingBox();assert(buttons.x+buttons.width<=390);
  await context.setOffline(true);
  await page.locator('#agenda .bullet-main').first().click();await page.locator('#projectRichEditor .outline-line').first().fill('Offline changed note');await page.locator('#bulletDialog .dialog-top-actions button[type=submit]').click();
  await page.locator('#quickMemoBtn').click();await page.locator('#projectRichEditor .outline-line').first().fill('Offline quick memo');await page.locator('#bulletDialog .dialog-top-actions button[type=submit]').click();
  await page.reload();await page.waitForFunction(()=>document.querySelector('#editor').value.includes('Offline quick memo'));
  assert((await page.locator('#editor').inputValue()).includes('Offline changed note'));assert.equal(patches,0);
  // Navigation with a new query must still load the cached application shell.
  await page.goto(url+'?offline-reopen=1');await page.waitForFunction(()=>document.querySelector('#editor').value.includes('Offline quick memo'));
  cloud=C.updateBullet(cloud,seed.bulletId,{details:'Cloud changed note'});version++;
  await context.setOffline(false);await page.waitForFunction(()=>document.querySelector('#conflictDialog').open);
  assert((await page.locator('#mergeChoices').innerText()).includes('Cloud changed note'));
  await page.locator('#laterBtn').click();await page.locator('#reviewConflictBtn').click();
  await page.locator('#mergeBtn').click();assert((await page.locator('#mergeError').innerText()).includes('選擇'));
  for(const input of await page.locator('#mergeChoices input[value=both]').all())await input.check();
  await page.locator('#mergeBtn').click();await page.waitForFunction(()=>!document.querySelector('#conflictDialog').open);await page.waitForFunction(()=>!window.DriveMemoUI.sync.getDebugSnapshot().localDirty);
  assert(cloud.includes('Offline quick memo')&&cloud.includes('Offline changed note')&&cloud.includes('Cloud changed note'));
  const before=patches;await page.locator('#logoutBtn').click();await page.reload();await page.waitForFunction(()=>document.querySelector('#editor').value.includes('Offline quick memo'));assert.equal(patches,before);assert(await page.locator('#loginBtn').isEnabled());
  assert.deepEqual(errors,[]);console.log('PASS mobile offline app reload, quick memo persistence, cache navigation, conflict UI, both-note merge and logout reload');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
