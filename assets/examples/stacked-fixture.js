import * as T from 'three';
import {solid, slabGeometry, revolvedSection, cylinderBetween} from './lib/geometry.js';
import {port, assemblyPart} from './lib/assembly.js';

// Original development fixture, dimensions in mm. No SKY-001 output or real product CAD.
// Whole layout -> construction functions -> flat semantic parts -> assembled checks.
export function makeLayout({pitch = 48, standHeight = 24, coverThickness = 4} = {}) {
  if (![pitch, standHeight, coverThickness].every(v => Number.isFinite(v) && v > 0) ||
      pitch <= 14 || pitch >= 64 || standHeight < 8 || coverThickness > 12)
    throw Error('Fixture dimensions exceed this example\'s supported layout');
  return {width: 80, depth: 40, baseThickness: 6, pitch, standHeight, coverThickness,
    boreRadius: 3.5, pinRadius: 3, sleeveRadius: 6,
    centers: [-pitch / 2, pitch / 2], coverZ: 6 + standHeight};
}

const circle = (x, radius) => Array.from({length: 96}, (_, i) => {
  const angle = -2 * Math.PI * i / 96;
  return [x + radius * Math.cos(angle), radius * Math.sin(angle)];
});

function buildPlate(layout, thickness, depth, material) {
  const w = layout.width / 2, d = depth / 2, chamfer = 3;
  const outline = [[-w + chamfer,-d],[w - chamfer,-d],[w,-d + chamfer],[w,d - chamfer],
    [w - chamfer,d],[-w + chamfer,d],[-w,d - chamfer],[-w,-d + chamfer]];
  // One executable recipe: explicit outline + two real holes -> extrusion.
  return solid(slabGeometry({outline, holes: layout.centers.map(x => circle(x, layout.boreRadius)), thickness}), material);
}

function buildSleeve(layout, material) {
  const r = layout.sleeveRadius, bore = layout.boreRadius, h = layout.standHeight;
  return solid(revolvedSection({section: [[0,bore],[0,r],[h,r],[h,bore]], segments: 96}), material);
}

function buildPin(layout, material) {
  const group = new T.Group(), top = layout.coverZ + layout.coverThickness;
  const shaft = cylinderBetween([0,0,-3], [0,0,top], layout.pinRadius, material);
  shaft.name = 'pin-shaft'; group.add(shaft);
  group.add(cylinderBetween([0,0,top], [0,0,top + 4], 5, material));
  return group;
}

export function buildScene(parameters = {}) {
  const layout = makeLayout(parameters), root = new T.Group(), parts = [], features = [], relations = [];
  const coverLift = 38;
  // The pin starts at z=-3; leave 12 mm above the exploded cover at every supported height.
  const pinLift = layout.coverZ + layout.coverThickness + coverLift + 15;
  const body = new T.MeshStandardMaterial({color: '#456575', roughness: .38, metalness: .35});
  const steel = new T.MeshStandardMaterial({color: '#aab4bd', roughness: .3, metalness: .7});
  const accent = new T.MeshStandardMaterial({color: '#c77c35', roughness: .35, metalness: .45});
  const add = (id, label, node, explode, ports = []) => {
    node.name = id; root.add(node);
    const part = assemblyPart({id, label, node, explode, ports,
      source: '原创教学尺寸；非真实产品参考或制造图纸', description: label});
    parts.push(part); return part;
  };
  const base = new T.Group(), baseMesh = buildPlate(layout, layout.baseThickness, layout.depth, body);
  baseMesh.name = 'base-plate'; base.add(baseMesh);
  add('base', '底板 · 孔距基准', base, [0,0,0]);
  const cover = new T.Group(), coverMesh = buildPlate(layout, layout.coverThickness, 24, body);
  coverMesh.name = 'cover-plate'; cover.add(coverMesh); cover.position.z = layout.coverZ;
  add('cover', '上板 · 随支撑高度定位', cover, [0,0,coverLift]);

  for (const [i, x] of layout.centers.entries()) {
    const side = i === 0 ? 'left' : 'right', label = i === 0 ? '左' : '右';
    const sleeve = new T.Group(), sleeveMesh = buildSleeve(layout, steel);
    sleeveMesh.name = 'sleeve'; sleeve.add(sleeveMesh); sleeve.position.set(x, 0, layout.baseThickness);
    const bottom = port(sleeve, {id: 'bottom', normal: [0,0,-1]});
    const top = port(sleeve, {id: 'top', position: [0,0,layout.standHeight]});
    add('sleeve-' + side, label + '空心支撑套', sleeve, [0,0,15], [bottom, top]);
    const pin = buildPin(layout, accent); pin.position.x = x;
    add('pin-' + side, label + '带头定位销', pin, [0,0,pinLift], [port(pin, {id: 'axis'})]);
    const basePort = port(base, {id: side, position: [x,0,layout.baseThickness]});
    const coverPort = port(cover, {id: side, position: [x,0,0], normal: [0,0,-1]});
    parts.find(p => p.id === 'base').ports.push(basePort);
    parts.find(p => p.id === 'cover').ports.push(coverPort);
    relations.push(
      {id: 'base-support-' + side, type: 'support', a: 'base.' + side, b: 'sleeve-' + side + '.bottom', tolerance: .01},
      {id: 'cover-support-' + side, type: 'support', a: 'sleeve-' + side + '.top', b: 'cover.' + side, tolerance: .01},
      {id: 'pin-axis-' + side, type: 'coaxial', a: 'base.' + side, b: 'pin-' + side + '.axis', tolerance: .01}
    );
    // Probes are anchored to the planned part frame, not to a possibly displaced mesh.
    // Expected bore diameter is the declared design requirement, never measured from output.
    for (const [name, node, mesh, height] of [
      ['base',base,baseMesh,layout.baseThickness], ['cover',cover,coverMesh,layout.coverThickness]
    ]) features.push({id: name + '-bore-' + side, type: 'bore', mesh,
      frame: port(node, {id: 'probe-' + side, position: [x,0,height]}),
      depth: height, expectedDiameter: 2 * layout.boreRadius, tolerance: .02});
  }
  const modelPlan = {schema: 'wireframe-model-plan/1', root: 'fixture', nodes: [
    {id: 'fixture', parent: null},
    {id: 'frame', parent: 'fixture'},
    {id: 'base', parent: 'frame', partId: 'base'},
    {id: 'sleeves', parent: 'frame', dependsOn: ['base']},
    {id: 'sleeve-left', parent: 'sleeves', partId: 'sleeve-left'},
    {id: 'sleeve-right', parent: 'sleeves', partId: 'sleeve-right'},
    {id: 'cover', parent: 'frame', partId: 'cover', dependsOn: ['sleeve-left', 'sleeve-right']},
    {id: 'pins', parent: 'fixture', dependsOn: ['base', 'cover']},
    {id: 'pin-left', parent: 'pins', partId: 'pin-left'},
    {id: 'pin-right', parent: 'pins', partId: 'pin-right'}
  ]};
  return {root, parts, modelPlan, layout, assembly: {root, parts, relations, features, grounded: ['base']},
    title: '双柱支撑组件 · 分层建模', renderStyle: 'studio', style: 'technical', direction: [1,-1.5,1],
    description: '原创教学试件，单位 mm。整体孔距与高度驱动底板、空心支撑套、上板和定位销；参数修改后重新构建并检查实际网格。非 SKY-001 生成结果，非制造级 CAD。'};
}
