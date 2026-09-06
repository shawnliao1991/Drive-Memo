const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const context={window:{},Date};vm.createContext(context);vm.runInContext(fs.readFileSync('content.js','utf8'),context);const c=context.window.DriveMemoContent;
const memo=c.addBullet('',{title:'待確認的Quick Memo',action:'待確認的Quick Memo',date:'2026-01-31',pending:true,priority:'today'});let text=memo.markdown;
assert.equal(c.getBullet(text,memo.bulletId).pending,true);text=c.updateBullet(text,memo.bulletId,{date:'2026-02-02'});assert.equal(c.getBullet(text,memo.bulletId).pending,true);assert.equal(c.getBullet(c.updateBullet(text,memo.bulletId,{priority:'today'}),memo.bulletId).pending,false);
text=c.addBullet(text,{action:'Month end',date:'2026-02-28'}).markdown;text=c.addBullet(text,{action:'Far future',date:'2027-01-01'}).markdown;
const week=c.getAgendaRange(text,'2026-01-31','week');assert.equal(week.length,8);
const month=c.getAgendaRange(text,'2026-01-31','month');assert.equal(month.length,9);assert.equal(month.at(-1).date,'2026-02-28');
const future=c.getAgendaRange(text,'2026-01-31','future');assert.equal(future.length,10);assert.equal(future.at(-1).date,'2027-01-01');
const counts=c.getMonthCounts(text,'2026-02');assert.equal(counts['2026-02-02'].pending,1);assert.equal(counts['2026-02-02'].today,0);
console.log('PASS pending memo lifecycle, date movement, sparse week/month/future ranges, clamped month end, calendar counters');
