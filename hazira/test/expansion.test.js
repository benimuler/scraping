'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {reviewedAsset}=require('../tools/content/fetch-photos');
const {ContentLibrary}=require('../server/content');
const content=new ContentLibrary();
const FINITE=['hebrew-months','zodiac','hebrew-letters','greek','colors','shapes','hands','weather','signs','flags-europe','flags-asia','flags-africa','flags-americas','map-europe','map-asia','map-americas','capitals-europe','capitals-asia','capitals-americas'];
test('approved finite-category variants reach fifty without inventing members',()=>{
 for(const id of FINITE) assert.ok(content.category(id).items.length>=50,id);
 assert.equal(new Set(content.category('hebrew-months').items.map(i=>i.answer)).size,12);
 assert.equal(new Set(content.category('zodiac').items.map(i=>i.answer)).size,12);
 assert.equal(new Set(content.category('hebrew-letters').items.map(i=>i.answer)).size,22);
});
test('every final prompt is unique within its category',()=>{
 for(const {id} of content.list()) {
  const c=content.category(id), keys=c.items.map(i=>i.image||i.text);
  assert.equal(new Set(keys).size,keys.length,id);
 }
});
test('expanded photo additions preserve source and free-license metadata',()=>{
 let n=0;
 for(const {id} of content.list().filter(c=>c.id.startsWith('photo-'))) {
  for(const i of content.category(id).items) {
   reviewedAsset(i);
   assert.ok(i.credit&&i.artist&&i.license,id);
   n++;
  }
 }
 assert.ok(n>=1651);
});
test('selector does not advertise option counts',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../public/js/player.js'),'utf8');
 assert.doesNotMatch(s,/\$\{c\.size\} פריטים/);
 assert.match(s,/\$\{c\.name\}<\/option>/);
});
test('comparison assets are self-contained, no screenshot-relative media paths',()=>{
 for(const {id} of content.list()) for(const i of content.category(id).items) {
  if(!/\/compare-/.test(i.image||'')) continue;
  const s=fs.readFileSync(path.join(__dirname,'../content',i.image.replace(/^\//,'')),'utf8');
  assert.ok(s.includes('data:image/svg+xml;base64,'));
  assert.ok(s.includes('מה מסומן בחץ?'));
 }
});
