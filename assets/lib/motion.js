// Original, engine-independent presentation controller. Times are seconds.
const unit = (value, name) => {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw Error(`${name} must be in [0,1]`);
  return value;
};
export function createMotion({ reduced = false, cycleAt = t => (1 - Math.cos(t * 1.3)) / 2 } = {}) {
  let amount = 0, goal = 0, velocity = 0, stroke = 0, time = 0, phaseOffset = 0;
  let paused = false, visible = true, cycling = false, armed = false;
  const settled = () => amount === goal && velocity === 0;
  const assembled = () => amount === 0 && goal === 0 && settled();
  const snapshot = () => ({ amount, goal, velocity, stroke, time, paused, visible,
    reduced, cycling, armed, settled: settled(),
    phase: armed ? 'assembling' : amount > 0 ? (settled() ? 'exploded' : 'moving') : cycling ? 'running' : 'ready' });
  const stop = () => { cycling = armed = false; };
  return {
    snapshot,
    reset() { amount = goal = velocity = stroke = time = phaseOffset = 0; paused = false; stop(); return snapshot(); },
    setPaused(value) { paused = Boolean(value); },
    setVisible(value) { visible = Boolean(value); },
    setReduced(value) { reduced = Boolean(value); if (reduced) { amount = goal; velocity = 0; stop(); } },
    explode(value, { immediate = false } = {}) {
      goal = unit(value, 'explode'); stop(); stroke = 0;
      if (immediate || reduced) { amount = goal; velocity = 0; }
      return snapshot();
    },
    setStroke(value) {
      unit(value, 'stroke');
      if (!assembled()) throw Error('Assemble before setting the working stroke');
      stop(); stroke = value; return snapshot();
    },
    cycle(value = true) {
      if (!value) { stop(); return snapshot(); }
      if (reduced) { stop(); return snapshot(); }
      // Ramp from the current manual position; no jump when taking over.
      phaseOffset = stroke; time = 0; goal = 0; paused = false; cycling = true; armed = !assembled();
      return snapshot();
    },
    sample({ explode = 0, stroke: value = 0, time: clock = 0 } = {}) {
      unit(explode, 'explode'); unit(value, 'stroke');
      if (!Number.isFinite(clock) || clock < 0) throw Error('time must be nonnegative');
      if (explode > 0 && value > 0) throw Error('Working stroke is disabled while exploded');
      amount = goal = explode; velocity = 0; stroke = value; time = clock; paused = true; stop();
      return snapshot();
    },
    step(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw Error('dt must be finite and nonnegative');
      if (paused || !visible || reduced) return snapshot();
      // Bound resumed-tab time; fixed small integration steps avoid frame-rate instability.
      let remaining = Math.min(dt, .05);
      while (remaining > 1e-9) {
        const h = Math.min(remaining, 1 / 240); remaining -= h;
        velocity += ((goal - amount) * 64 - velocity * 16) * h;
        amount = Math.max(0, Math.min(1, amount + velocity * h));
        if (Math.abs(amount - goal) < 1e-5 && Math.abs(velocity) < 1e-5) { amount = goal; velocity = 0; }
        if (cycling && assembled()) {
          armed = false; time += h;
          const target = unit(cycleAt(time), 'cycleAt result'), blend = Math.min(1, time / .35);
          stroke = phaseOffset * (1 - blend) + target * blend;
        } else if (amount > 0) stroke = 0;
      }
      return snapshot();
    }
  };
}
