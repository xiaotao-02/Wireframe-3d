"""Regression checks for staged explosion, actual geometry separation and camera bounds.
Does not render shaders or prove continuous collision clearance.
"""
import argparse, json, shutil, subprocess, tempfile
from pathlib import Path
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--three', type=Path, required=True)
p.add_argument('--report', type=Path, required=True)
args = p.parse_args()
skill = Path(__file__).resolve().parents[1]
if json.loads((args.three / 'package.json').read_text(encoding='utf8'))['version'] != '0.187.0':
    raise SystemExit('Expected Three.js 0.187.0')
with tempfile.TemporaryDirectory(prefix='wireframe-explosion-') as temp:
    work = Path(temp)
    shutil.copytree(skill / 'assets/lib', work / 'lib')
    shutil.copy2(skill / 'scripts/explosion_checks.mjs', work / 'checks.mjs')
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
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
    print(f"{report['status'].upper()}: {args.report}")
    raise SystemExit(result.returncode or (report['status'] == 'fail'))
