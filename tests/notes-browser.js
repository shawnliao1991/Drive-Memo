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
  await page.goto("http://localhost/tests/notes.html");
  await page.waitForFunction(()=>document.querySelector("#result")?.textContent!=="RUNNING");
  assert.equal(await page.locator("#result").innerText(),"PASS");
  console.log("PASS notebook keyboard, clipboard, empty rows, navigation and migration");
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

