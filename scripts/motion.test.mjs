import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotion} from '../assets/lib/motion.js';
const advance = (m, seconds, hz = 60) => { for (let i = 0; i < seconds * hz; i++) m.step(1 / hz); return m.snapshot(); };
test('arming waits for actual assembly, then runs', () => {
  const m = createMotion(); m.explode(1, {immediate:true}); m.cycle();
  let s = m.step(.04); assert.equal(s.armed, true); assert.equal(s.time, 0); assert.equal(s.stroke, 0);
  s = advance(m, 4); assert.equal(s.amount, 0); assert.equal(s.armed, false); assert.ok(s.time > 0);
});
test('pause and offscreen freeze all model clocks and spring positions', () => {
  const m = createMotion(); m.explode(1); advance(m, .1); m.setPaused(true);
  const s = m.snapshot(); assert.deepEqual(advance(m, 3), s);
  m.setPaused(false); m.setVisible(false); const hidden = m.snapshot(); assert.deepEqual(advance(m, 3), hidden);
});
test('reduced motion still accepts explicit targets, no continuous cycle', () => {
  const m = createMotion({reduced:true}); m.explode(.5); assert.equal(m.snapshot().amount, .5);
  m.explode(0); m.setStroke(.8); m.cycle(); assert.equal(m.snapshot().cycling, false); assert.equal(m.snapshot().stroke, .8);
});
test('manual takeover stops cycle and starts subsequent cycle continuously', () => {
  const m = createMotion(); m.cycle(); advance(m, 1); m.setStroke(.7);
  assert.equal(m.snapshot().cycling, false); m.cycle(); assert.equal(m.snapshot().stroke, .7);
  assert.ok(Math.abs(m.step(1/240).stroke - .7) < .02);
});
test('time-based trajectories agree at 30 and 120 Hz', () => {
  const a=createMotion(), b=createMotion(); a.explode(.8); b.explode(.8);
  assert.ok(Math.abs(advance(a, 1, 30).amount - advance(b, 1, 120).amount) < 1e-9);
});
test('reset, replay and invalid states are explicit', () => {
  const m=createMotion(); m.sample({explode:.5}); assert.throws(()=>m.setStroke(1));
  assert.throws(()=>m.sample({explode:.5,stroke:1})); assert.throws(()=>m.step(NaN));
  assert.throws(()=>m.sample({time:-1})); m.reset(); assert.equal(m.snapshot().stroke,0); assert.equal(m.snapshot().paused,false);
});
test('explicit run after pause or sampled pose resumes the clock', () => {
 const m=createMotion();m.sample({stroke:.7});m.cycle();assert.equal(m.snapshot().paused,false);
 assert.ok(advance(m,.5).time>0);m.setPaused(true);m.cycle(false);assert.equal(m.snapshot().cycling,false);
 m.cycle(true);assert.equal(m.snapshot().paused,false);assert.ok(advance(m,.5).time>0);
});
test('invalid manual stroke leaves a running assembly command intact', () => {
 const m=createMotion();m.explode(1,{immediate:true});m.cycle();const before=m.snapshot();
 assert.throws(()=>m.setStroke(.5));assert.deepEqual(m.snapshot(),before);
});
