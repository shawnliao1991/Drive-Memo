// Run with Playwright on NODE_PATH. All browser requests are intercepted.
const {chromium}=require("playwright");
const fs=require("node:fs");
const assert=require("node:assert/strict");
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe"});
 try{
  const context=await browser.newContext({serviceWorkers:"block"});
  const localFiles=new Set(["tests/notes.html","index.html",...fs.readdirSync(".").filter(f=>f.endsWith(".js"))]);
  await context.route("**/*",route=>{
   const u=new URL(route.request().url()),name=u.pathname.slice(1);
   if(u.origin!=="http://localhost"||!localFiles.has(name))return route.abort();
   return route.fulfill({body:fs.readFileSync(name),contentType:name.endsWith(".js")?"text/javascript":"text/html; charset=utf-8"});
  });
  const page=await context.newPage();page.on("pageerror",error=>console.error(error.message));
  await page.addInitScript(()=>{
   localStorage.setItem("driveMemoLoggedOut","true");
   window.loginRequests=0;
   window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){window.loginRequests++}})}}};
  });
  await page.goto("http://localhost/index.html");
  await page.waitForFunction(()=>Boolean(window.DriveMemoUI));
  await page.getByRole("button",{name:"登入",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.loginRequests),1);
  console.log("PASS journal startup and Google login button dispatch");
  await page.goto("http://localhost/tests/notes.html");
  await page.waitForFunction(()=>document.querySelector("#result")?.textContent!=="RUNNING");
  assert.equal(await page.locator("#result").innerText(),"PASS");
  await page.setViewportSize({width:1200,height:900});
  await page.locator("iframe").evaluate(el=>{el.style.width="1100px";el.style.height="760px"});
  const frame=page.frameLocator("iframe"),guide=frame.getByRole("button",{name:"縮排線",exact:true});
  await guide.click();assert.equal(await guide.getAttribute("aria-pressed"),"false");
  assert.equal(await frame.locator(".tree-guides").first().evaluate(el=>getComputedStyle(el).backgroundImage),"none");
  await guide.click();assert.equal(await guide.getAttribute("aria-pressed"),"true");
  async function dragBefore(source,target){
   await source.scrollIntoViewIfNeeded();
   const a=await source.boundingBox(),b=await target.boundingBox();
   await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
   await page.mouse.move(b.x+b.width/2,b.y+2,{steps:10});
   assert.ok((await target.getAttribute("class")).includes("drop-above"));
   await page.mouse.up();
  }
  const rows=frame.locator(".note-row");
  await dragBefore(rows.nth(2).locator("textarea"),rows.first());
  assert.equal(await rows.first().locator("textarea").inputValue(),"C");
  const columns=frame.locator(".note-column"),pages=columns.nth(1).locator(".note-card");
  const title=await pages.last().locator(".card-caption").textContent();
  await dragBefore(pages.last().locator(".note-card-name"),pages.first());
  assert.equal(await pages.first().locator(".card-caption").textContent(),title);
  await columns.first().locator(".note-add").click();
  await frame.locator(".note-card-dialog input").first().fill("Second shelf");
  await frame.getByRole("button",{name:"儲存",exact:true}).last().click();
  const books=columns.first().locator(".note-card");
  await dragBefore(books.last().locator(".note-card-name"),books.first());
  assert.equal(await books.first().locator(".card-caption").textContent(),"Second shelf");
  console.log("PASS notebook keyboard, clipboard, empty rows, navigation and migration");
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

