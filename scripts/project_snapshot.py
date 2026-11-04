"""Create an immutable source snapshot; detect changes during copying and verify ZIP bytes."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import zipfile

SKIP = {'.git', 'node_modules', '__pycache__'}
def entries(root):
    result = {}
    for p in sorted(root.rglob('*')):
        rel = p.relative_to(root)
        if any(x in SKIP for x in rel.parts) or p.suffix == '.pyc':
            continue
        if p.is_symlink() or (hasattr(p, 'is_junction') and p.is_junction()):
            raise ValueError('Snapshot requires local files, not symbolic links: ' + str(rel))
        if p.is_file():
            result[rel.as_posix()] = p
    return result

def sha(data):
    return hashlib.sha256(data).hexdigest()

def snapshot(source, output, *, before_verify=None):
    source, output = Path(source).resolve(), Path(output).resolve()
    if not source.is_dir() or output == source or output.is_relative_to(source):
        raise ValueError('Output must be outside the source directory')
    output.mkdir(parents=True, exist_ok=True)
    stamp = datetime.datetime.now().astimezone().strftime('%Y%m%d-%H%M%S-%f')
    name = source.name + '-' + stamp
    partial, final = output / (name + '.partial'), output / name
    partial.mkdir()
    manifest = {'source': str(source), 'created': stamp, 'excluded': sorted(SKIP), 'files': []}
    initial = entries(source)
    if not initial:
        raise ValueError('No source files to snapshot')
    if 'SNAPSHOT-MANIFEST.json' in initial:
        raise ValueError('Reserved snapshot manifest already exists in source; select the original project directory')
    for relative, path in initial.items():
        data = path.read_bytes()
        dest = partial / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        manifest['files'].append({'path': relative, 'bytes': len(data), 'sha256': sha(data)})
    if before_verify:
        before_verify()  # deterministic race injection for tests
    current = entries(source)
    if current.keys() != initial.keys() or any(sha(current[e['path']].read_bytes()) != e['sha256'] for e in manifest['files']):
        raise RuntimeError('Source changed during snapshot. Unverified .partial retained; retry after edits settle.')
    (partial / 'SNAPSHOT-MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
    # Both resolved targets are confined to the explicitly selected output directory.
    assert partial.resolve().parent == output and final.resolve().parent == output
    partial.rename(final)
    archive = output / (name + '.zip')
    with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED) as bundle:
        for p in sorted(final.rglob('*')):
            if p.is_file():
                bundle.write(p, name + '/' + p.relative_to(final).as_posix())
    with zipfile.ZipFile(archive) as bundle:
        if bundle.testzip() is not None:
            raise RuntimeError('ZIP CRC failure')
        for e in manifest['files']:
            if sha(bundle.read(name + '/' + e['path'])) != e['sha256']:
                raise RuntimeError('Archived bytes differ: ' + e['path'])
    return {'directory': str(final), 'archive': str(archive), 'files': len(manifest['files']), 'sha256': sha(archive.read_bytes()), 'verified': True}

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    print(json.dumps(snapshot(a.source, a.out), ensure_ascii=False, indent=2))
