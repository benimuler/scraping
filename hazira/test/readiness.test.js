'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('../server/game');
const { ContentLibrary } = require('../server/content');
const content = new ContentLibrary();
function setup() { const g = new Game({content}); const ids = ['a','b'].map(name=>g.addPlayer({name})); return {g,ids}; }
function accept(g, ids, action) { const e=g.readinessEpoch; for(const id of ids) g.requestReady(id,action,e); }
function finish(g, loser) { if(g.phase==='duel_intro'){g._deadline.at=Date.now()-1;g._tick();} g.surrender(loser);g._deadline.at=Date.now()-1;g._tick(); }
test('initial start needs two distinct players, stale actions cannot advance',()=>{
 const {g,ids:[a,b]}=setup();const e=g.readinessEpoch;
 g.requestReady(a,'start',e);g.requestReady(a,'start',e);assert.equal(g.phase,'lobby');
 assert.throws(()=>g.requestReady('spectator','start',e));
 g.requestReady(b,'start',e);assert.equal(g.phase,'duel_intro');assert.equal(g.duel.item,null);
 assert.ok(g.snapshot(a).deadlineInMs>4000);
 assert.throws(()=>g.requestReady(a,'start',e));g.dispose();
});
test('next round and new match each need both consents',()=>{
 const {g,ids}=setup();accept(g,ids,'start');finish(g,ids[1]);
 g.requestReady(ids[0],'rematch',g.readinessEpoch);assert.equal(g.phase,'finished');assert.equal(g.series.round,1);
 g.requestReady(ids[1],'rematch',g.readinessEpoch);assert.equal(g.series.round,2);finish(g,ids[1]);
 assert.ok(g.matchWinnerId);g.requestReady(ids[0],'newmatch',g.readinessEpoch);assert.equal(g.series.round,2);assert.ok(g.matchWinnerId);
 g.requestReady(ids[1],'newmatch',g.readinessEpoch);assert.equal(g.series.round,1);assert.equal(g.matchWinnerId,null);g.dispose();
});
test('disconnect clears consent, blocks start, and reconnect does not auto-start',()=>{
 const {g,ids:[a,b]}=setup();const e=g.readinessEpoch;g.requestReady(a,'start',e);g.setConnected(b,false);
 assert.equal(g.readyIds.size,0);assert.throws(()=>g.requestReady(a,'start',g.readinessEpoch));
 g.setConnected(b,true);assert.equal(g.phase,'lobby');assert.throws(()=>g.requestReady(b,'start',e));
 accept(g,[a,b],'start');g.setConnected(b,false);assert.equal(g.phase,'duel_paused');assert.equal(g._deadline,null);
 g.setConnected(b,true);assert.equal(g.phase,'duel_paused');accept(g,[a,b],'resume');assert.equal(g.phase,'duel_intro');
 g._deadline.at=Date.now()-1;g._tick();const clocks={...g.duel.clocks};const item=g.duel.item;
 g.setConnected(a,false);assert.equal(g.phase,'duel_paused');assert.deepEqual(g.duel.clocks,clocks);
 g.setConnected(a,true);accept(g,[a,b],'resume');g._deadline.at=Date.now()-1;g._tick();assert.equal(g.duel.item,item);g.dispose();
});
