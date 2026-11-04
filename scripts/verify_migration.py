"""Run migration and rendering-state regressions with a local Three.js package. No browser render."""
import argparse,json,shutil,subprocess,tempfile
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--three',type=Path,required=True);p.add_argument('--report',type=Path,required=True);a=p.parse_args()
skill=Path(__file__).resolve().parents[1]
if json.loads((a.three/'package.json').read_text(encoding='utf8'))['version']!='0.187.0':raise SystemExit('Expected Three.js 0.187.0')
with tempfile.TemporaryDirectory(prefix='wireframe-migration-') as directory:
 work=Path(directory);shutil.copytree(skill/'assets/lib',work/'lib');shutil.copy2(skill/'assets/examples/indexed-workcell.js',work/'subject.js');shutil.copy2(skill/'scripts/migration_checks.mjs',work/'checks.mjs')
 (work/'package.json').write_text('{"type":"module"}',encoding='utf8');runtime=work/'node_modules/three';runtime.mkdir(parents=True);shutil.copy2(a.three/'package.json',runtime/'package.json');shutil.copytree(a.three/'build',runtime/'build')
 result=subprocess.run(['node',str(work/'checks.mjs')],capture_output=True,text=True,encoding='utf8')
 try:report=json.loads(result.stdout)
 except json.JSONDecodeError:report={'status':'fail','error':result.stderr or result.stdout}
 a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(report,ensure_ascii=False));raise SystemExit(result.returncode or (report['status']=='fail'))
