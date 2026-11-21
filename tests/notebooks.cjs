const assert=require("node:assert/strict");
global.window=global;
require("../content.js");
require("../merge.js");
const C=DriveMemoContent;
const old=C.updateJournal("",j=>{
 j.notes.push({id:"page1",folder:"工作",title:"一",rows:[{type:"text",text:"A",depth:0}]});
 j.notes.push({id:"page2",folder:"工作",title:"二",rows:[]});
});
const base=C.parse(old).journal;
assert.equal(base.notebooks.length,1);
assert.equal(base.notes[0].bookId,base.notes[1].bookId);
assert.deepEqual(base.notes.map(n=>n.order),[0,1]);
const local=C.updateJournal(old,j=>{
 j.notebooks[0].title="開發";j.notebooks[0].icon="★";j.notebooks[0].color="#abcdef";
 j.notes[0].order=1;j.notes[1].order=0;
 j.notebooks.push({id:"empty",title:"未分類",order:1});
});
const remote=C.updateJournal(old,j=>{j.notes[0].rows[0].collapsed=true});
const plan=DriveMemoMerge.prepare(old,local,remote);
assert.equal(plan.conflicts.length,0);
const merged=C.parse(plan.build({})).journal;
assert.deepEqual(merged.notebooks,C.parse(local).journal.notebooks);
assert.deepEqual(merged.notes.map(n=>n.order),[1,0]);
assert.equal(merged.notes[0].rows[0].collapsed,true);
console.log("PASS notebook migration, empty books, card appearance, order and independent page changes");
