import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleClock, sampleClocks, boundaryTimes} from '../assets/lib/process-timing.js';

test('negative source offset retains battery tray handoff rather than clamping to zero', () => {
  const clock = {period:32, offset:-16};
  assert.equal(cycleClock(0,clock).phase,16);
  assert.ok(cycleClock(16-1e-5,clock).phase>31.999);
  assert.equal(cycleClock(16,clock).phase,0);
  assert.ok(cycleClock(16+1e-5,clock).phase<.001);
  assert.notEqual(cycleClock(0,clock).phase,cycleClock(0,{period:32}).phase);
});
test('HOME gate is half-open at entry/exit and accepts windows across cycle zero', () => {
  const spec={period:12,windows:[[2,5],[10,1]]};
  for(const [time,active] of [[0,true],[1,false],[2,true],[5,false],[9,false],[10,true],[12,true],[13,false]])assert.equal(cycleClock(time,spec).active,active);
  assert.equal(cycleClock(2-1e-6,spec).active,false);assert.equal(cycleClock(5-1e-6,spec).active,true);
  assert.equal(cycleClock(3,{period:12,windows:[]}).active,false);
});
test('vehicles use independent cycle lengths and offsets at the same global time', () => {
  const defs={a:{period:16,offset:-3},b:{period:25,offset:4},c:{period:19,offset:0,windows:[[2,8]]}};
  const state=sampleClocks(38,defs);assert.equal(state.a.phase,3);assert.equal(state.b.phase,17);assert.equal(state.c.phase,0);assert.equal(state.c.active,false);
  assert.deepEqual(sampleClocks(38,defs),state);assert.notEqual(state.a.phase,state.b.phase);
});
test('sampling includes before, exactly on, after global boundaries and both cycle endpoints', () => {
  const ts=boundaryTimes({period:32,offset:-16,boundaries:[0,8],from:0,to:64,epsilon:.001});
  for(const boundary of [16,24,48,56])for(const d of [-.001,0,.001])assert.ok(ts.some(t=>Math.abs(t-boundary-d)<1e-10));
  assert.equal(ts[0],0);assert.equal(ts.at(-1),64);assert.equal(new Set(ts).size,ts.length);
});
test('invalid periods, ambiguous zero windows and excessive sampling are rejected', () => {
  for(const period of [0,-1,NaN,Infinity])assert.throws(()=>cycleClock(0,{period}));
  for(const windows of [[[2,2]],[[0,15]],[[-1,2]]])assert.throws(()=>cycleClock(0,{period:12,windows}));
  assert.throws(()=>boundaryTimes({period:1,to:1e8}));
});
