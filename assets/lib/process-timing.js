// Pure factory timing helpers. A caller must still port draw() offsets, payload gates and poses.
// Offsets use phase = positiveModulo(time + offset, period), in seconds.
import {cycleTime, inCycleWindow} from './factory-process.js';
export function cycleClock(time, {period, offset = 0, windows = null} = {}) {
  if (![time, period, offset].every(Number.isFinite) || period <= 0) throw Error('Expected finite time/offset and positive period');
  if (windows !== null && (!Array.isArray(windows) || windows.some(w =>
    !Array.isArray(w) || w.length !== 2 || !w.every(Number.isFinite) ||
    w[0] < 0 || w[0] >= period || w[1] < 0 || w[1] > period || w[0] === w[1]))) throw Error('Invalid half-open activity windows');
  const shifted = time + offset;
  if (!Number.isFinite(shifted)) throw Error('Clock overflow');
  // factory-process calls its offset a delay (time - offset); this source-formula adapter is additive.
  const {local:phase,cycle}=cycleTime(time,period,-offset);
  const active=windows===null||windows.some(window=>inCycleWindow(phase,window,period));
  return {phase,cycle,active};
}

export function sampleClocks(time, definitions) {
  return Object.fromEntries(Object.entries(definitions).map(([id, definition]) => [id, cycleClock(time, definition)]));
}

// Add both sides of every declared phase boundary to a project's time-sample list.
// Finite samples detect boundary regressions, not continuous collision freedom.
export function boundaryTimes({period, offset = 0, boundaries = [0], from = 0, to = period, epsilon = 1e-4}) {
  cycleClock(from, {period, offset});
  if (![to, epsilon].every(Number.isFinite) || to < from || epsilon <= 0 || epsilon >= period / 2 ||
      !Array.isArray(boundaries) || boundaries.some(b => !Number.isFinite(b) || b < 0 || b > period)) throw Error('Invalid boundary sampling range');
  const times = new Set([from, to]);
  for (const boundary of boundaries) {
    const first = Math.ceil((from + offset - boundary - epsilon) / period);
    const last = Math.floor((to + offset - boundary + epsilon) / period);
    if (last - first > 100000) throw Error('Boundary sampling budget exceeded');
    for (let k = first; k <= last; k++) for (const d of [-epsilon, 0, epsilon]) {
      const t = k * period + boundary - offset + d;
      if (t >= from && t <= to) times.add(t);
    }
  }
  return [...times].sort((a, b) => a - b);
}
