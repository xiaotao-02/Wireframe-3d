import {explosionWeight} from './explosion.js';
// Same pose path for live rendering, fixed-state capture and numerical checks.
export function createSceneRuntime(model) {
  const {root, parts} = model;
  if (!root?.isObject3D || !Array.isArray(parts) || !parts.length) throw Error('buildScene needs root and parts');
  if (model.assembly && (model.assembly.root !== root ||
      model.assembly.parts?.length !== parts.length || parts.some(p => !model.assembly.parts.some(a => a.id === p.id && a.node === p.node))))
    throw Error('Assembly audit must reference the same root and parts as the rendered model');
  const ids = new Set(), nodes = new Set(), rest = new Map();
  for (const part of parts) {
    if (typeof part.id !== 'string' || !part.id || ids.has(part.id) || nodes.has(part.node) ||
        !part.node?.isObject3D || part.node.parent !== root || !Array.isArray(part.explode) ||
        part.explode.length !== 3 || !part.explode.every(Number.isFinite)) throw Error('Invalid semantic part: ' + part.id);
    ids.add(part.id); nodes.add(part.node); part.node.userData.partId = part.id;
    if (part.explodeRange !== undefined && (!Array.isArray(part.explodeRange) || part.explodeRange.length !== 2 ||
        !part.explodeRange.every(Number.isFinite) || part.explodeRange[0] < 0 || part.explodeRange[1] > 1 ||
        part.explodeRange[0] >= part.explodeRange[1])) throw Error('Invalid explodeRange: ' + part.id);
    if (part.hideOnExplode !== undefined && typeof part.hideOnExplode !== 'boolean') throw Error('Invalid hideOnExplode: ' + part.id);
  }
  // Save nested pivots too. Legacy additive setPose callbacks now cannot accumulate drift.
  root.traverse(node => rest.set(node, {position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(), visible: node.visible}));
  let current = null, telemetry = {};
  function apply({amount = 0, stroke = 0, time = 0} = {}) {
    if (![amount, stroke, time].every(Number.isFinite) || amount < 0 || amount > 1 || stroke < 0 || stroke > 1 || time < 0) throw Error('Invalid pose');
    for (const [node, pose] of rest) {node.position.copy(pose.position); node.quaternion.copy(pose.quaternion); node.scale.copy(pose.scale); node.visible = pose.visible;}
    const effectiveStroke = amount > 0 ? 0 : stroke;
    telemetry = model.setPose?.({stroke: effectiveStroke, explode: amount, time}) || {};
    // Apply offsets AFTER the callback: absolute motion assignments cannot erase explosion.
    for (const part of parts) {
      const weight = explosionWeight(part, amount);
      part.node.position.x += weight * part.explode[0];
      part.node.position.y += weight * part.explode[1];
      part.node.position.z += weight * part.explode[2];
      if (amount > 0 && part.hideOnExplode) part.node.visible = false;
    }
    if (amount > 0) for (const node of rest.keys()) if (node.userData.hideOnExplode) node.visible = false;
    root.updateMatrixWorld(true);
    current = {amount, stroke: effectiveStroke, time};
    return telemetry;
  }
  return {apply, snapshot() { return {pose: {...current}, telemetry: structuredClone(telemetry),
    parts: Object.fromEntries(parts.map(p => [p.id, {position: p.node.position.toArray(), quaternion: p.node.quaternion.toArray(), scale: p.node.scale.toArray(), visible: p.node.visible}]))}; }};
}
