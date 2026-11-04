"""Execute bounded assembly tests and injected defects using local Three.js, not a browser."""
import argparse,json,shutil,subprocess,tempfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--three',type=Path,required=True);p.add_argument('--report',type=Path,required=True);args=p.parse_args()
skill=Path(__file__).resolve().parents[1]
if json.loads((args.three/'package.json').read_text(encoding='utf-8'))['version']!='0.187.0':raise SystemExit('Expected tested Three.js 0.187.0')
with tempfile.TemporaryDirectory(prefix='anatomy-assembly-') as tmp:
    work=Path(tmp);shutil.copytree(skill/'assets/lib',work/'lib');shutil.copy2(skill/'assets/examples/pneumatic-press.js',work/'pneumatic-press.js');shutil.copy2(skill/'scripts/assembly_checks.mjs',work/'checks.mjs')
    (work/'package.json').write_text('{"type":"module"}',encoding='utf8');runtime=work/'node_modules/three';runtime.mkdir(parents=True)
    shutil.copy2(args.three/'package.json',runtime/'package.json');shutil.copytree(args.three/'build',runtime/'build')
    result=subprocess.run(['node',str(work/'checks.mjs')],capture_output=True,text=True,encoding='utf8')
    try: data=json.loads(result.stdout)
    except json.JSONDecodeError: data={'status':'fail','error':result.stderr or result.stdout}
    args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
    print(f"{data.get('status','pass').upper()}: {args.report}")
    raise SystemExit(result.returncode or (data.get('status')=='fail'))
