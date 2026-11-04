"""Sample a builder's real meshes and declared assembly using the live pose runtime.
Does not render, judge reference fidelity, or prove continuous motion clearance.
"""
import argparse, json, shutil, subprocess, tempfile
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
source = p.add_mutually_exclusive_group(required=True)
source.add_argument('--builder', type=Path)
source.add_argument('--example', choices=['contact-switch', 'pneumatic-press', 'flanged-chamber', 'river-pavilion', 'indexed-workcell'])
p.add_argument('--three', type=Path, required=True)
p.add_argument('--report', type=Path, required=True)
args = p.parse_args()
skill = Path(__file__).resolve().parents[1]
builder = args.builder or skill / 'assets/examples' / f'{args.example}.js'
if json.loads((args.three / 'package.json').read_text(encoding='utf8'))['version'] != '0.187.0':
    raise SystemExit('Expected Three.js 0.187.0')
with tempfile.TemporaryDirectory(prefix='wireframe-scene-') as temp:
    work = Path(temp)
    shutil.copytree(skill / 'assets/lib', work / 'lib')
    shutil.copy2(builder, work / 'subject.js')
    shutil.copy2(skill / 'scripts/scene_checks.mjs', work / 'checks.mjs')
    (work / 'package.json').write_text('{"type":"module"}', encoding='utf8')
    package = work / 'node_modules/three'
    package.mkdir(parents=True)
    shutil.copy2(args.three / 'package.json', package / 'package.json')
    shutil.copytree(args.three / 'build', package / 'build')
    result = subprocess.run(['node', str(work / 'checks.mjs')], text=True, capture_output=True, encoding='utf8')
    try:
        report = json.loads(result.stdout)
    except json.JSONDecodeError:
        report = {'status': 'fail', 'error': result.stderr or result.stdout}
    report['builder'] = str(builder.resolve())
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
    print(f"{report['status'].upper()}: {args.report}")
    raise SystemExit(result.returncode or (report['status'] == 'fail'))
