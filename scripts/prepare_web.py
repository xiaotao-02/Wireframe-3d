"""Copy the local web starter and the exact installed Three.js runtime."""
import argparse
import json
import shutil
import hashlib
from pathlib import Path

parser=argparse.ArgumentParser()
source=parser.add_mutually_exclusive_group(required=True)
source.add_argument('--scene',type=Path,help='Original shared pump mesh manifest')
source.add_argument('--builder',type=Path,help='ES module exporting buildScene(); imports ./lib/* or three')
source.add_argument('--example',choices=['river-pavilion','flanged-chamber','pneumatic-press','contact-switch','indexed-workcell','curved-shell','optical-sensor'],help='Editable teaching fixtures; see each builder for provenance')
parser.add_argument('--three',type=Path,required=True,help='Path to node_modules/three (0.187.0)')
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--reference',type=Path,help='Validated wireframe-reference/1 record; package images and the review page')
parser.add_argument('--extra',action='append',default=[],help='Relative file or glob under the builder directory; copy and hash (repeatable)')
args=parser.parse_args()
if args.scene and (args.reference or args.extra): raise SystemExit('--reference/--extra require a builder or example')
package=json.loads((args.three/'package.json').read_text(encoding='utf-8'))
if package['version']!='0.187.0': raise SystemExit('Expected Three.js 0.187.0; review and test API changes before upgrading.')
required=['build/three.module.js','build/three.core.js','examples/jsm/controls/OrbitControls.js','LICENSE']
missing=[name for name in required if not (args.three/name).is_file()]
if missing: raise SystemExit('Incomplete Three.js installation; missing: '+', '.join(missing)+'. Use the complete package, not the numerical-test build-only copy.')
args.out.mkdir(parents=True,exist_ok=True)
skill=Path(__file__).resolve().parents[1]
for name in ('preview-ui.css','preview-ui.js'):
    shutil.copy2(skill/'assets/web'/name,args.out/name)
if args.scene:
    for name in ('index.html','app.js'): shutil.copy2(skill/'assets/web'/name,args.out/name)
    shutil.copy2(args.scene,args.out/'scene.json')
else:
    builder=args.builder or skill/'assets/examples'/f'{args.example}.js'
    if not builder.is_file(): raise SystemExit(f'Missing builder: {builder}')
    shutil.copy2(skill/'assets/web/studio.html',args.out/'index.html')
    shutil.copy2(skill/'assets/web/studio.js',args.out/'studio.js')
    shutil.copy2(builder,args.out/'subject.js')
    shutil.copytree(skill/'assets/lib',args.out/'lib',dirs_exist_ok=True)
(args.out/'package.json').write_text('{"type":"module","private":true}',encoding='utf-8')
if (skill/'licenses').is_dir(): shutil.copytree(skill/'licenses',args.out/'licenses',dirs_exist_ok=True)
vendor=args.out/'vendor';vendor.mkdir(exist_ok=True)
for name in ('three.module.js','three.core.js'): shutil.copy2(args.three/'build'/name,vendor/name)
shutil.copy2(args.three/'examples/jsm/controls/OrbitControls.js',vendor/'OrbitControls.js')
shutil.copy2(args.three/'LICENSE',vendor/'THREE-LICENSE.txt')
# Content-addressed evidence identifies the prepared files, not an old screenshot folder.
if not args.scene:
    extra_files=[]
    reserved={'index.html','studio.js','subject.js','preview-ui.js','preview-ui.css','package.json','preview-manifest.json','build-info.js','reference.json','review.html','review.js','review.css'}
    source_root=builder.resolve().parent
    for pattern in args.extra:
        if Path(pattern).is_absolute() or '..' in Path(pattern).parts: raise SystemExit('--extra must stay inside the builder directory')
        matches=sorted(p for p in source_root.glob(pattern) if p.is_file())
        if not matches: raise SystemExit('No --extra files matched: '+pattern)
        for path in matches:
            if not path.resolve().is_relative_to(source_root): raise SystemExit('--extra symlink escapes builder directory')
            relative=path.relative_to(source_root)
            if relative.as_posix() in reserved or relative.parts[0] in {'lib','vendor','references'}: raise SystemExit('--extra conflicts with generated files: '+str(relative))
            destination=args.out/relative
            destination.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(path,destination);extra_files.append(destination)
    if args.reference:
        from reference_constraints import validate
        reference=json.loads(args.reference.read_text(encoding='utf8'))
        errors=validate(reference,args.reference.parent)
        if errors: raise SystemExit('Invalid reference record:\n'+'\n'.join(errors))
        for i,record in enumerate(reference['sources']):
            path=(args.reference.parent/record['path']).resolve()
            destination=args.out/'references'/f'{i}-{record["sha256"][:12]}{path.suffix.lower()}'
            destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,destination)
            record['path']=destination.relative_to(args.out).as_posix();extra_files.append(destination)
        destination=args.out/'reference.json'
        destination.write_text(json.dumps(reference,ensure_ascii=False,indent=2),encoding='utf8');extra_files.append(destination)
        for name in ('review.html','review.js','review.css'):
            destination=args.out/name;shutil.copy2(skill/'assets/web'/name,destination);extra_files.append(destination)
    files=[args.out/name for name in ('index.html','studio.js','subject.js','preview-ui.js','preview-ui.css')]
    files+=sorted((args.out/'lib').glob('*.js'))+sorted(vendor.glob('*.js'))+extra_files
    hashes={f.relative_to(args.out).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in files}
    build={'schema':'wireframe-build/1','three':package['version'],'files':hashes}
    build['id']=hashlib.sha256(json.dumps(hashes,sort_keys=True).encode()).hexdigest()
    (args.out/'build-info.js').write_text('export default '+json.dumps(build,ensure_ascii=False)+';\n',encoding='utf8')
    (args.out/'preview-manifest.json').write_text(json.dumps(build,ensure_ascii=False,indent=2),encoding='utf8')
print(args.out/'index.html')
