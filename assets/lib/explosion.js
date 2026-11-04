import * as T from 'three';

// Offsets use the part parent's coordinates. No mechanical disassembly path is inferred.
export function explosionWeight(part, amount) {
  if (!part.explodeRange) return amount; // Preserve existing linear builders.
  const [start, end] = part.explodeRange;
  const t = T.MathUtils.clamp((amount - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

// Projection of actual rendered mesh vertices, including instances and parent transforms.
// Ignore illustration helpers; visibility is deliberately ignored for structural auditing.
export function meshProjection(root, axis) {
  if (!Array.isArray(axis) || axis.length !== 3 || !axis.every(Number.isFinite) || new T.Vector3(...axis).lengthSq() < 1e-12) throw Error('Invalid projection axis');
  const direction = new T.Vector3(...axis).normalize(), vertex = new T.Vector3(), instance = new T.Matrix4(), world = new T.Matrix4();
  let min = Infinity, max = -Infinity, vertices = 0;
  root.updateWorldMatrix(true, true);
  function walk(node) {
    if (node.userData.auditIgnore || node.userData.isIllustrationDecoration) return;
    if (node.isMesh) {
      if (node.isSkinnedMesh || node.morphTargetInfluences?.length) throw Error('Deformed meshes need a dedicated explosion measurement');
      const positions = node.geometry?.attributes.position;
      if (!positions) throw Error('Missing mesh positions');
      for (let i = 0; i < (node.isInstancedMesh ? node.count : 1); i++) {
        world.copy(node.matrixWorld);
        if (node.isInstancedMesh) {node.getMatrixAt(i, instance); world.multiply(instance);}
        for (let j = 0; j < positions.count; j++) {
          const distance = vertex.fromBufferAttribute(positions, j).applyMatrix4(world).dot(direction);
          if (!Number.isFinite(distance)) throw Error('Nonfinite projected vertex');
          min = Math.min(min, distance); max = Math.max(max, distance); vertices++;
        }
      }
    }
    for (const child of node.children) walk(child);
  }
  walk(root);
  if (!vertices) throw Error('No measurable mesh vertices');
  return {min, max, vertices};
}

export function auditExplosion(model, {amount = 0} = {}) {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) throw Error('Invalid explosion amount');
  const rules = model.explosionChecks || [], parts = new Map(model.parts.map(p => [p.id, p.node])), ids = new Set();
  const results = rules.map(rule => {
    if (!rule.id || ids.has(rule.id) || !parts.has(rule.a) || !parts.has(rule.b) || rule.a === rule.b || !Number.isFinite(rule.minGap) || rule.minGap < 0) throw Error('Invalid explosion rule: ' + rule.id);
    ids.add(rule.id);
    const at = rule.at || [1];
    if (!Array.isArray(at) || !at.length || at.some(a => !Number.isFinite(a) || a <= 0 || a > 1)) throw Error('Invalid explosion samples: ' + rule.id);
    if (!at.some(a => Math.abs(a - amount) < 1e-6)) return {id: rule.id, status: 'not-applicable'};
    const a = meshProjection(parts.get(rule.a), rule.axis), b = meshProjection(parts.get(rule.b), rule.axis), gap = b.min - a.max;
    return {id: rule.id, status: gap >= rule.minGap - 1e-6 ? 'pass' : 'fail', gap, minGap: rule.minGap, a, b};
  });
  const passed = results.filter(r => r.status === 'pass').length, failed = results.filter(r => r.status === 'fail').length;
  return {status: !rules.length ? 'unconfigured' : failed ? 'fail' : passed ? 'pass' : 'not-applicable', passed, failed, results,
    scope: 'Declared ordered part pairs at discrete poses; positive projected gaps are sufficient separation, not a continuous collision proof.'};
}
