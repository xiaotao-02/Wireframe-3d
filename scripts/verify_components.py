"""Run numerical component checks with an explicit local Three.js installation.
This does not render a page or certify visual quality.
"""
import argparse,json,shutil,subprocess,tempfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--three',type=Path,required=True);p.add_argument('--report',type=Path,required=True);args=p.parse_args()
skill=Path(__file__).resolve().parents[1]
assert json.loads((args.three/'package.json').read_text(encoding='utf8'))['version']=='0.187.0','Expected Three.js 0.187.0'
with tempfile.TemporaryDirectory(prefix='anatomy-components-') as tmp:
    work=Path(tmp);shutil.copytree(skill/'assets/lib',work/'lib')
    for name in ['river-pavilion','flanged-chamber']:shutil.copy2(skill/'assets/examples'/f'{name}.js',work/f'{name}.js')
    shutil.copy2(skill/'scripts/component_checks.mjs',work/'checks.mjs')
    (work/'package.json').write_text('{"type":"module"}',encoding='utf8')
    runtime=work/'node_modules/three';runtime.mkdir(parents=True)
    shutil.copy2(args.three/'package.json',runtime/'package.json');shutil.copytree(args.three/'build',runtime/'build')
    result=subprocess.run(['node',str(work/'checks.mjs')],capture_output=True,text=True,encoding='utf8')
    try: report=json.loads(result.stdout)
    except json.JSONDecodeError: report={'status':'fail','error':result.stderr or result.stdout}
    args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(f"{report.get('status','pass').upper()}: {args.report}")
    raise SystemExit(result.returncode or (report.get('status')=='fail'))
