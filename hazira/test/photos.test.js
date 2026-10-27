'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CATEGORIES } = require('../tools/content/photos');
const { validate } = require('../tools/content/fetch-photos');
const { findCollisions } = require('../tools/content/build');
const fs = require('fs');
const path = require('path');
test('all 19 photo pools are reviewed, licensed, attributed, deep and unique', () => {
  assert.equal(CATEGORIES.length, 19);
  let count = 0;
  for (const c of CATEGORIES) {
    validate(c);
    assert.ok(c.items.length >= 25, `${c.id}: ${c.items.length}`);
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
      assert.match(i.source, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      assert.ok(i.credit && i.license && i.artist);
    }
  }
});
test('dinosaurs are honestly labeled as photographed museum skeletons', () => {
  assert.match(CATEGORIES.find((c) => c.id === 'photo-dinos').name, /שלדים/);
});
