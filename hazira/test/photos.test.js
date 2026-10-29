'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CATEGORIES } = require('../tools/content/photos');
const { validate, reviewedAsset } = require('../tools/content/fetch-photos');
const { findCollisions } = require('../tools/content/build');
const fs = require('fs');
const path = require('path');
test('all photo pools are reviewed, licensed, attributed, deep and unique', () => {
  assert.ok(CATEGORIES.length >= 20);
  let count = 0;
  for (const c of CATEGORIES) {
    validate(c);
    const minimum = c.id === 'photo-hands' ? 14 : c.id === 'photo-masterpieces' ? 15 : 25; // Finite, distinct gestures: never pad with near-duplicates.
    assert.ok(c.items.length >= minimum, `${c.id}: ${c.items.length}`);
    assert.deepEqual(findCollisions(c), [], `${c.id}: ambiguous answers`);
    count += c.items.length;
  }
  assert.ok(count >= 790, `only ${count} reviewed items`);
});
test('wrong subject assets and drawings removed', () => {
  for (const c of CATEGORIES) for (const i of c.items) {
    assert.doesNotMatch(i.image, /Jim_Clark|Dax-chart|POMEGRANDE|\.svg|K%C3%B6hler|Kohler|distribution|Range_of_harp|Common-nuts/i);
  }
});
test('build retains source and license provenance in every photo pack', () => {
  for (const c of CATEGORIES) {
    const pack = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'packs', c.id+'.json'), 'utf8'));
    assert.equal(pack.items.length, c.items.length);
    for (const i of pack.items) {
      reviewedAsset(i);
      assert.ok(i.credit && i.license && i.artist);
    }
  }
});
test('dinosaurs are honestly labeled as photographed museum skeletons', () => {
  assert.match(CATEGORIES.find((c) => c.id === 'photo-dinos').name, /שלדים/);
});
test('Met asset validation is exact-host and object-bound, never a general external bypass', () => {
  const base = {answer:'בדיקה',reviewed:true,source:'https://www.metmuseum.org/art/collection/search/436105',image:'https://images.metmuseum.org/CRDImages/ep/web-large/DP-13139-001.jpg',artist:'Jacques Louis David',credit:'The Met',license:'CC0',licenseUrl:'https://www.metmuseum.org/openaccess',provider:'met',objectID:436105,isPublicDomain:true,metadataSource:'https://collectionapi.metmuseum.org/public/collection/v1/objects/436105'};
  const check = item => validate({id:'test',items:[item]});
  assert.doesNotThrow(()=>check(base));
  for(const change of [
    {image:base.image.replace('images.metmuseum.org','images.metmuseum.org.evil.test')},
    {source:base.source.replace('www.metmuseum.org','unverified.test')},
    {image:base.image.replace('/CRDImages/','/unverified/')},
    {objectID:436106},{isPublicDomain:false},{license:'CC BY 4.0'},
    {metadataSource:base.metadataSource.replace('436105','436106')},
    {provider:undefined},{licenseUrl:'https://example.test/license'},
    {image:base.image.replace('https:','http:')},
    {image:base.image.replace('.jpg','.svg')},
  ]) assert.throws(()=>check({...base,...change}),JSON.stringify(change));
});
test('new issuer adapters reject mismatched IDs, hosts and restricted photo licenses',()=>{
 for(const provider of ['smithsonian-nasm','inaturalist']){
  const items=CATEGORIES.flatMap(c=>c.items).filter(i=>i.provider===provider);assert.ok(items.length);
  const base=items[0];reviewedAsset(base);
  for(const patch of [{image:base.image.replace('https://','http://')},{source:'https://example.test/observation/1'},{provider:undefined},{license:'CC BY-NC 4.0'},provider==='inaturalist'?{photoID:1}:{mediaID:'NASM-wrong'},provider==='inaturalist'?{photoLicenseCode:'cc-by-nc'}:{image:base.image.replace('ids.si.edu','evil.si.edu')}])assert.throws(()=>reviewedAsset({...base,...patch}));
 }
});

test('NMNH exact reviewed object/media bindings reject substitutions and rights changes',()=>{
 const items=CATEGORIES.flatMap(c=>c.items).filter(i=>i.provider==='smithsonian-nmnh');
 assert.equal(items.length,10);
 for(const base of items){
  reviewedAsset(base);
  for(const patch of [{provider:undefined},{objectID:'nmnhmineralsciences_1'},{mediaID:'ark:/65665/m3wrong'},{isPublicDomain:false},{metadataSource:'https://www.si.edu/object/other'},{license:'CC BY-NC 4.0'},{licenseUrl:'https://example.test/'},{source:base.source.replace('https://','http://')},{image:base.image.replace('ids.si.edu','evil.si.edu')},{image:base.image+'&extra=1'},{image:items.find(i=>i.mediaID!==base.mediaID).image},{source:items.find(i=>i.objectID!==base.objectID).source}]) assert.throws(()=>reviewedAsset({...base,...patch}));
 }
});

test('USGS exact source/photo bindings reject substitutions and rights changes',()=>{
 const items=CATEGORIES.flatMap(c=>c.items).filter(i=>i.provider==='usgs');
 assert.equal(items.length,30);
 for(const base of items){
  reviewedAsset(base);
  for(const patch of [{provider:undefined},{objectID:'unknown-photo'},{isPublicDomain:false},{metadataSource:'https://www.usgs.gov/media/images/other'},{license:'CC BY-NC 4.0'},{licenseUrl:'https://example.test/'},{source:base.source.replace('https://','http://')},{image:base.image.replace('d9-wret','another-bucket')},{image:base.image+'&extra=1'},{image:items.find(i=>i.image!==base.image).image},{source:items.find(i=>i.source!==base.source).source}]) assert.throws(()=>reviewedAsset({...base,...patch}));
 }
});

test('DVIDS exact source/photo bindings reject substitutions, missing disclaimer and rights changes',()=>{
 const items=CATEGORIES.flatMap(c=>c.items).filter(i=>i.provider==='dvids');assert.equal(items.length,3);
 for(const base of items){
  reviewedAsset(base);
  for(const patch of [{provider:undefined},{objectID:1},{isPublicDomain:false},{metadataSource:'https://www.dvidshub.net/image/1/other'},{credit:'DVIDS'},{license:'CC BY-NC 4.0'},{licenseUrl:'https://example.test/'},{source:base.source.replace('https://','http://')},{image:base.image.replace('d1ldvf68ux039x','other')},{image:base.image+'?extra=1'},{image:items.find(i=>i.image!==base.image).image},{source:items.find(i=>i.source!==base.source).source}]) assert.throws(()=>reviewedAsset({...base,...patch}));
 }
});

test('DVIDS sports photos remain quarantined without established likeness coverage',()=>{assert.throws(()=>reviewedAsset({"answer":"כדורסל","aliases":[],"image":"https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/1310/1035742/1000w_q95.jpg","source":"https://www.dvidshub.net/image/1035742/basketball-slam-dunk-djiboutian-american-relations","artist":"Petty Officer 1st Class Thomas Ouellette","license":"Public domain","licenseUrl":"https://www.dvidshub.net/about/copyright","credit":"Petty Officer 1st Class Thomas Ouellette / DVIDS · Public domain. The appearance of U.S. Department of War (DoW) visual information does not imply or constitute DoW endorsement.","subjectTitle":"Basketball slam dunk for Djiboutian-American relations [Image 2 of 6] — dvidshub.net","subjectSource":"https://www.dvidshub.net/image/1035742/basketball-slam-dunk-djiboutian-american-relations","difficulty":2,"reviewed":true,"provider":"dvids","objectID":1035742,"isPublicDomain":true,"metadataSource":"https://www.dvidshub.net/image/1035742/basketball-slam-dunk-djiboutian-american-relations"}));});

test('Pexels only accepts exact reviewed page and item-only media bindings',()=>{
 const items=CATEGORIES.flatMap(c=>c.items).filter(i=>i.provider==='pexels');assert.equal(items.length,36);
 for(const base of items){
  reviewedAsset(base);
  for(const patch of [{provider:undefined},{objectID:1},{metadataSource:'https://www.pexels.com/photo/other-1/'},{license:'Public domain'},{licenseUrl:'https://example.test/'},{source:base.source.replace('https:','http:')},{source:base.source.replace('www.pexels.com','www.pexels.com.evil.test')},{image:base.image.replace('images.pexels.com','evil.test')},{image:base.image+'&extra=1'},{image:items.find(i=>i.image!==base.image).image},{source:items.find(i=>i.source!==base.source).source}]) assert.throws(()=>reviewedAsset({...base,...patch}));
 }
});
