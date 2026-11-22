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
  assert.match(await page.locator("body").evaluate(el=>getComputedStyle(el).fontFamily),/Arial.*Noto Sans TC/);
  await page.getByRole("button",{name:"登入",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.loginRequests),1);
  console.log("PASS journal startup and Google login button dispatch");
  await page.locator("#quickMemoBtn").click();
  const actionRows=page.locator("#actionRowsEditor .tree-text");
  await actionRows.first().fill("Action parent");await actionRows.first().press("End");await actionRows.first().press("Enter");
  await actionRows.nth(1).fill("Action child");await actionRows.nth(1).press("Tab");
  await page.locator("#bulletDialog button[type=submit]").click();
  await page.locator("#agenda .bullet-main").first().click();
  assert.equal(await page.locator("#bulletDialog .dialog-head #bulletAction").count(),1);
  await page.locator("#bulletDateButton").click();
  assert(await page.locator("#datePicker .calendar-day").first().isVisible());
  await page.locator("#bulletDateButton").click();
  assert.equal(await page.locator("#priorityPicker").evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(" ").length),4);
  assert.equal(await page.locator("#actionRowsEditor .note-info, #actionRowsEditor .note-guides-btn").count(),0);
  assert.deepEqual(await actionRows.evaluateAll(fields=>fields.map(f=>f.value)),["Action parent","Action child"]);
  assert.equal(await actionRows.nth(1).evaluate(f=>f.closest(".note-row").style.getPropertyValue("--depth")),"1");
  await actionRows.nth(1).fill("Cancelled edit");await page.locator("#cancelBulletBtn").click();
  await page.locator("#agenda .bullet-main").first().click();assert.equal(await actionRows.nth(1).inputValue(),"Action child");
  await page.locator("#cancelBulletBtn").click();
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
  const first=rows.first().locator("textarea");
  await first.fill("Alpha beta gamma");await first.click();
  const a=await first.boundingBox();
  await page.mouse.move(a.x+6,a.y+a.height/2);await page.mouse.down();
  await page.mouse.move(a.x+65,a.y+a.height/2,{steps:8});await page.mouse.up();
  assert(await first.evaluate(f=>f.selectionEnd>f.selectionStart));
  assert.equal(await frame.locator(".note-row.selected").count(),0);
  const second=await rows.nth(1).locator("textarea").boundingBox(),third=await rows.nth(2).boundingBox();
  await page.mouse.move(second.x+12,second.y+8);await page.mouse.down();
  await page.mouse.move(second.x+12,third.y+third.height/2,{steps:8});await page.mouse.up();
  assert.equal(await frame.locator(".note-row.selected").count(),2);
  await page.keyboard.press("Escape");
  await dragBefore(rows.nth(2).locator(".tree-dot"),rows.first());
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
  await columns.nth(1).locator(".note-add").click();
  await frame.locator(".note-card-dialog input").first().fill("Existing page");
  await frame.locator(".note-card-dialog").getByRole("button",{name:"儲存",exact:true}).click();
  await books.last().locator(".note-card-name").click();
  const moving=pages.last(),movingTitle=await moving.locator(".card-caption").textContent();
  const noteBox=await moving.locator(".note-card-name").boundingBox(),bookBox=await books.first().boundingBox();
  const dragAcross=async y=>{
   await page.mouse.move(noteBox.x+20,noteBox.y+noteBox.height/2);await page.mouse.down();
   await page.mouse.move(bookBox.x+20,y,{steps:12});
  };
  await dragAcross(bookBox.y+bookBox.height/2);
  assert.match(await books.first().getAttribute("class"),/drop-transfer/);
  await page.mouse.up();
  assert.deepEqual(await pages.locator(".card-caption").allTextContents(),["Existing page",movingTitle]);
  assert.equal(await pages.last().locator(".note-card-name").getAttribute("aria-current"),"true");
  await books.last().locator(".note-card-name").click();
  assert(!(await pages.locator(".card-caption").allTextContents()).includes(movingTitle));
  console.log("PASS notebook keyboard, clipboard, empty rows, navigation and migration");
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

