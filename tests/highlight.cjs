const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{},crypto:require('node:crypto').webcrypto,Date};vm.createContext(context);vm.runInContext(fs.readFileSync('content.js','utf8'),context);const c=context.window.DriveMemoContent;
let first=c.addBullet('',{action:'Monday',date:'2026-08-31',priority:'today'}),text=first.markdown;
const id=c.getViewModel(text,'2026-09-06').carryCandidates[0].id;
const done=c.getBullet(c.batchHighlight(text,[id],'done','2026-09-06'),id);assert.equal(done.status,'done');assert.equal(done.date,'2026-08-31');
const moved=c.getBullet(c.batchHighlight(text,[id],'week','2026-09-06'),id);assert.equal(moved.date,'2026-09-07');assert.equal(moved.status,'todo');
text=c.updateBullet(text,id,{date:'2026-08-30'});assert.equal(c.getBullet(c.batchHighlight(text,[id],'week','2026-09-06'),id).date,'2026-09-13');
assert.equal(c.batchHighlight(text,[],'week','2026-09-06'),text);
console.log('PASS Done preserves date; next calendar week preserves Monday/Sunday; empty selection unchanged');
