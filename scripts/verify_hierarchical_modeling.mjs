import {register} from 'node:module';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const args = Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all) => v.startsWith('--') ? [...a,[v.slice(2),all[i+1]]] : a, []));
if (!args.three) throw Error('Use --three /path/to/three [--report report.json]');
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const threeURL = pathToFileURL(resolve(args.three, 'build/three.module.js')).href;
const builderURL = pathToFileURL(resolve(skill, 'assets/examples/stacked-fixture.js')).href;
const libURL = pathToFileURL(resolve(skill, 'assets/lib') + '/').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){
 if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};
 if(c.parentURL===${JSON.stringify(builderURL)}&&s.startsWith('./lib/'))return {url:new URL(s.slice(6),${JSON.stringify(libURL)}).href,shortCircuit:true};
 return n(s,c);
}`), import.meta.url);
const T = await import(threeURL);
const {buildScene} = await import(builderURL);
const {auditModelPlan, affectedPartIds} = await import('../assets/lib/model-plan.js');
const {auditAssembly} = await import('../assets/lib/assembly.js');
const {createSceneRuntime} = await import('../assets/lib/scene-runtime.js');
const checks = [], samples = [];
const test = (name, fn) => {try {fn(); checks.push({name,status:'pass'});} catch(e) {checks.push({name,status:'fail',error:e.stack});}};
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-4, `${a} != ${b}`);
const ids = model => model.parts.map(p => p.id).sort();
const dispose = model => {
  const geometry = new Set(), material = new Set();
  model.root.traverse(o => {if(o.geometry)geometry.add(o.geometry);for(const m of [o.material].flat())if(m)material.add(m);});
  geometry.forEach(g => g.dispose()); material.forEach(m => m.dispose());
};
function fixtureCheck(fn, parameters) {const model = buildScene(parameters); try {fn(model);} finally {dispose(model);}}

test('A plan is optional; the fixture binds all six real flat parts', () => fixtureCheck(model => {
  assert.equal(auditModelPlan(model).status, 'pass');
  assert.equal(model.parts.length, 6);
  assert.ok(model.parts.every(p => p.node.parent === model.root));
  const {modelPlan, ...legacy} = model;
  assert.equal(auditModelPlan(legacy).status, 'unconfigured');
  assert.equal(auditModelPlan({...legacy,modelPlan:null}).status, 'fail');
}));

test('Missing parents, disconnected cycles and dependencies on descendants are rejected', () => fixtureCheck(model => {
  const check = mutate => {const modelPlan=structuredClone(model.modelPlan);mutate(modelPlan);assert.equal(auditModelPlan({...model,modelPlan}).status,'fail');};
  check(p => p.nodes.find(n => n.id==='base').parent='missing');
  check(p => p.nodes.push({id:'other-root',parent:null,partId:'unused'}));
  check(p => {p.nodes.find(n=>n.id==='frame').parent='sleeves';});
  check(p => p.nodes.find(n=>n.id==='fixture').dependsOn=['cover']);
  check(p => p.nodes.find(n=>n.id==='base').dependsOn=['missing']);
}));

test('Duplicate IDs, duplicate bindings, empty assemblies and absent live parts cannot pass', () => fixtureCheck(model => {
  const check = mutate => {const modelPlan=structuredClone(model.modelPlan);mutate(modelPlan);assert.equal(auditModelPlan({...model,modelPlan}).status,'fail');};
  check(p => p.nodes.push({...p.nodes[0]}));
  check(p => p.nodes.find(n=>n.id==='cover').partId='base');
  check(p => p.nodes.find(n=>n.id==='cover').partId='nonexistent');
  check(p => delete p.nodes.find(n=>n.id==='cover').partId);
  assert.equal(auditModelPlan({...model,parts:model.parts.slice(1)}).status,'fail');
  assert.equal(auditModelPlan({...model,parts:[...model.parts,model.parts[0]]}).status,'fail');
  const extra = new T.Group();model.root.add(extra);
  assert.equal(auditModelPlan({...model,parts:[...model.parts,{id:'unplanned',node:extra}]}).status,'fail');
  model.parts[0].node.removeFromParent();assert.equal(auditModelPlan(model).status,'fail');
}));

test('Declared changes include descendants and transitive dependants, without touching scene parenting', () => fixtureCheck(model => {
  assert.deepEqual(affectedPartIds(model.modelPlan,['base']).sort(),ids(model));
  assert.deepEqual(affectedPartIds(model.modelPlan,['sleeve-left']).sort(),['cover','pin-left','pin-right','sleeve-left']);
  assert.deepEqual(affectedPartIds(model.modelPlan,['pins']).sort(),['pin-left','pin-right']);
  assert.deepEqual(affectedPartIds(model.modelPlan,[]),[]);
  assert.throws(()=>affectedPartIds(model.modelPlan,['unknown']),/known/);
  assert.ok(model.parts.every(p=>p.node.parent===model.root));
}));

for (const parameters of [{pitch:48,standHeight:24,coverThickness:4},{pitch:56,standHeight:32,coverThickness:7},{pitch:32,standHeight:16,coverThickness:3}]) {
  test('Rebuild moves real bores, supports and pin endpoints together: '+JSON.stringify(parameters), () => fixtureCheck(model => {
    const runtime = createSceneRuntime(model); runtime.apply();
    const audit=auditAssembly(model.assembly);assert.equal(audit.status,'pass',JSON.stringify(audit));
    assert.equal(auditModelPlan(model).status,'pass');
    const box=name=>new T.Box3().setFromObject(model.root.getObjectByName(name));
    const coverZ=6+parameters.standHeight, top=coverZ+parameters.coverThickness;
    near(box('base-plate').min.x,-40);near(box('base-plate').max.x,40);
    near(box('cover-plate').min.z,coverZ);near(box('cover-plate').max.z,top);
    for (const [side,x] of [['left',-parameters.pitch/2],['right',parameters.pitch/2]]) {
      const sleeve=model.root.getObjectByName('sleeve-'+side), pin=model.root.getObjectByName('pin-'+side);
      near(new T.Box3().setFromObject(sleeve).getCenter(new T.Vector3()).x,x);
      near(new T.Box3().setFromObject(sleeve).min.z,6);near(new T.Box3().setFromObject(sleeve).max.z,coverZ);
      const shaft=new T.Box3().setFromObject(pin.getObjectByName('pin-shaft'));
      near(shaft.min.z,-3);near(shaft.max.z,top);near(shaft.getCenter(new T.Vector3()).x,x);
      for (const name of ['base-plate','cover-plate']) {
        const mesh=model.root.getObjectByName(name);
        const hit=offset=>new T.Raycaster(new T.Vector3(x+offset,0,top+20),new T.Vector3(0,0,-1)).intersectObject(mesh);
        assert.equal(hit(0).length,0,'Real through-hole at independently expected center');
        assert.equal(hit(3.3).length,0,'Hole has declared radius');
        assert.ok(hit(3.7).length>0,'Material outside the bore remains');
      }
    }
    // At full explosion every pin must clear the actual upper plate, even in taller variants.
    runtime.apply({amount:1});
    for (const side of ['left','right']) {
      const pinBox=box('pin-'+side), coverBox=box('cover-plate'), sleeveBox=box('sleeve-'+side);
      assert.ok(pinBox.min.z-coverBox.max.z >= 12-1e-4, 'Pin fully clears exploded cover');
      assert.ok(coverBox.min.z-sleeveBox.max.z > 0, 'Cover clears sleeve');
      assert.ok(sleeveBox.min.z-box('base-plate').max.z > 0, 'Sleeve clears base');
    }
    runtime.apply();
    samples.push({parameters,plan:auditModelPlan(model),assembly:audit.status,explodedGeometry:'pass',partIds:ids(model)});
  }, parameters));
}

test('A stale upper plate after a height change fails the actual assembled support checks', () => fixtureCheck(model => {
  createSceneRuntime(model).apply();model.root.getObjectByName('cover').position.z-=8;
  assert.equal(auditAssembly(model.assembly).results.find(r=>r.id==='cover-support-left').status,'fail');
}, {standHeight:32}));

test('Moving only plate geometry leaves a valid plan but fails independent real-hole probes', () => fixtureCheck(model => {
  createSceneRuntime(model).apply();model.root.getObjectByName('cover-plate').geometry.translate(1,0,0);
  assert.equal(auditModelPlan(model).status,'pass');
  const audit=auditAssembly(model.assembly);
  assert.equal(audit.results.find(r=>r.id==='cover-support-left').status,'pass');
  assert.equal(audit.results.find(r=>r.id==='cover-bore-left').status,'fail');
}));

test('Rest and exploded poses remain idempotent with the separate planning hierarchy', () => fixtureCheck(model => {
  const runtime=createSceneRuntime(model);runtime.apply();const initial=runtime.snapshot();
  for(const amount of [.5,1,.25]) {runtime.apply({amount});const pose=runtime.snapshot();runtime.apply({amount});assert.deepEqual(runtime.snapshot(),pose);}
  runtime.apply();assert.deepEqual(runtime.snapshot(),initial);
  assert.deepEqual(model.parts.map(p=>p.id).sort(),['base','cover','pin-left','pin-right','sleeve-left','sleeve-right']);
}));

test('Invalid layout parameters are rejected before constructing geometry', () => {
  for(const parameters of [{pitch:Infinity},{pitch:70},{pitch:10},{standHeight:0},{coverThickness:20}])assert.throws(()=>buildScene(parameters),/layout/);
});

const report={status:checks.every(c=>c.status==='pass')?'pass':'fail',checks,samples,
  scope:'Original development fixture, graph fault injection and real mesh parameter rebuilds. Not a held-out modeling task, CAD history or SKY-001 replication.',
  visual:'NOT_RUN',referenceFidelity:'NOT_APPLICABLE',independentTask:'NOT_RUN'};
if(args.report){await mkdir(dirname(resolve(args.report)),{recursive:true});await writeFile(args.report,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));if(report.status==='fail')process.exitCode=1;
