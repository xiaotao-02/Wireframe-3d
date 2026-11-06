// Optional planning tree, separate from Three.js parenting and assembly constraints.
// Dependencies describe what must be rebuilt/rechecked, not a CAD constraint solver.
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

function compile(plan) {
  if (plan?.schema !== 'wireframe-model-plan/1' || !nonempty(plan.root) ||
      !Array.isArray(plan.nodes) || !plan.nodes.length) throw Error('Expected wireframe-model-plan/1 with root and nodes');
  const byId = new Map(), children = new Map(), next = new Map(), bindings = new Set();
  for (const node of plan.nodes) {
    if (!nonempty(node?.id) || byId.has(node.id)) throw Error('Invalid or duplicate plan node: ' + node?.id);
    if (node.parent !== null && !nonempty(node.parent)) throw Error('Explicit parent required: ' + node.id);
    if (node.partId !== undefined) {
      if (!nonempty(node.partId) || bindings.has(node.partId)) throw Error('Invalid or duplicate part binding: ' + node.partId);
      bindings.add(node.partId);
    }
    if (node.dependsOn !== undefined && (!Array.isArray(node.dependsOn) ||
        node.dependsOn.some(id => !nonempty(id)) || new Set(node.dependsOn).size !== node.dependsOn.length))
      throw Error('Invalid dependsOn: ' + node.id);
    byId.set(node.id, node); children.set(node.id, []); next.set(node.id, new Set());
  }
  if (!byId.has(plan.root) || byId.get(plan.root).parent !== null) throw Error('Invalid plan root');
  for (const node of plan.nodes) {
    if (node.id !== plan.root) {
      if (!byId.has(node.parent)) throw Error('Missing parent for ' + node.id);
      children.get(node.parent).push(node.id);
      next.get(node.parent).add(node.id);
    }
    for (const upstream of node.dependsOn || []) {
      if (!byId.has(upstream)) throw Error('Unknown dependency: ' + upstream);
      next.get(upstream).add(node.id);
    }
  }
  for (const node of plan.nodes) {
    const isLeaf = children.get(node.id).length === 0;
    if (isLeaf !== (node.partId !== undefined)) throw Error('Only leaf nodes bind a part; every leaf needs partId: ' + node.id);
  }
  // Parent edges participate too: a parent cannot depend on its own descendant.
  const incoming = new Map(plan.nodes.map(n => [n.id, 0]));
  for (const targets of next.values()) for (const id of targets) incoming.set(id, incoming.get(id) + 1);
  const order = [...incoming].filter(([, count]) => count === 0).map(([id]) => id);
  for (let i = 0; i < order.length; i++) for (const target of next.get(order[i])) {
    incoming.set(target, incoming.get(target) - 1);
    if (incoming.get(target) === 0) order.push(target);
  }
  if (order.length !== plan.nodes.length) throw Error('Cycle in hierarchy or build dependencies');
  return {byId, next, order, bindings};
}

export function auditModelPlan(model) {
  const scope = 'Planning structure and exact live part bindings only; not geometry quality, construction execution, dependency completeness or CAD validity.';
  if (model.modelPlan === undefined) return {status: 'unconfigured', scope};
  try {
    const graph = compile(model.modelPlan);
    if (!model.root?.isObject3D || !Array.isArray(model.parts)) throw Error('Model needs root and parts');
    const ids = new Set(), objects = new Set();
    for (const part of model.parts) {
      if (!nonempty(part.id) || ids.has(part.id) || objects.has(part.node) ||
          !part.node?.isObject3D || part.node.parent !== model.root) throw Error('Invalid live part: ' + part.id);
      ids.add(part.id); objects.add(part.node);
      if (!graph.bindings.has(part.id)) throw Error('Unplanned live part: ' + part.id);
    }
    for (const id of graph.bindings) if (!ids.has(id)) throw Error('Plan refers to missing live part: ' + id);
    return {status: 'pass', nodes: graph.byId.size, parts: ids.size, order: graph.order, scope};
  } catch (error) {
    return {status: 'fail', reason: error.message, scope};
  }
}

// Lists declared downstream parts. Does not mutate/reparent the scene or rebuild it.
// A changed assembly includes descendants; a changed leaf includes its dependants.
export function affectedPartIds(plan, changedNodeIds) {
  const graph = compile(plan);
  if (!Array.isArray(changedNodeIds) || changedNodeIds.some(id => !graph.byId.has(id)))
    throw Error('Changed nodes must be known plan node IDs');
  const reached = new Set(changedNodeIds), queue = [...reached];
  for (let i = 0; i < queue.length; i++) for (const id of graph.next.get(queue[i])) if (!reached.has(id)) {
    reached.add(id); queue.push(id);
  }
  return graph.order.filter(id => reached.has(id) && graph.byId.get(id).partId !== undefined)
    .map(id => graph.byId.get(id).partId);
}
