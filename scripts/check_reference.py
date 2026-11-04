"""Check reference-review evidence freshness/completeness, never visual similarity."""
import argparse
import hashlib
import json
from pathlib import Path

def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def tree_hash(root):
    root = Path(root).resolve()
    if not root.is_dir():
        raise ValueError('Build directory missing')
    files = sorted(p for p in root.rglob('*') if p.is_file())
    if not files:
        raise ValueError('Build directory is empty')
    if any(p.is_symlink() or not p.resolve().is_relative_to(root) for p in files):
        raise ValueError('Build fingerprint cannot follow external links')
    values = [(p.relative_to(root).as_posix(), file_hash(p)) for p in files]
    return hashlib.sha256(json.dumps(values, ensure_ascii=False).encode()).hexdigest()

def review(root, record):
    root = Path(root).resolve()
    def local(value):
        p = (root / value).resolve()
        if not p.is_relative_to(root):
            raise ValueError('Evidence paths must be inside project root')
        return p
    errors, blockers, pending, differences = [], [], [], []
    try:
        build = record['build']
        actual_hash = tree_hash(local(build['path']))
        if actual_hash != build['sha256']:
            errors.append('Build changed after capture: evidence is stale')
        views = {}
        for view in record['views']:
            if not view['id'] or view['id'] in views:
                raise ValueError('Unique view IDs required')
            views[view['id']] = view
            if view['buildSha256'] != build['sha256']:
                errors.append('View captured from another build: ' + view['id'])
            for role in ('reference', 'actual'):
                item = view[role]
                if file_hash(local(item['path'])) != item['sha256']:
                    errors.append('Image changed: ' + item['path'])
            if local(view['reference']['path']) == local(view['actual']['path']):
                errors.append('Reference and render must be separate artifacts')
            if not view.get('state') or not view.get('alignment', {}).get('note'):
                errors.append('Capture state and alignment explanation required: ' + view['id'])
            if view.get('alignment', {}).get('status') != 'checked':
                pending.append('Unverified comparison view: ' + view['id'])
        ids = set()
        for feature in record['features']:
            fid = feature['id']
            if not fid or fid in ids:
                raise ValueError('Unique feature IDs required')
            ids.add(fid)
            if not feature.get('source') or not feature.get('implementation') or not feature.get('note') or not isinstance(feature.get('critical'), bool):
                errors.append('Incomplete feature: ' + fid)
            if not feature.get('views') or any(v not in views for v in feature['views']):
                errors.append('Missing comparison view: ' + fid)
            status = feature['status']
            if status == 'different':
                differences.append(fid)
                if feature['critical']:
                    blockers.append(fid)
            elif status == 'unverified':
                pending.append(fid)
            elif status != 'matched':
                errors.append('Invalid feature status: ' + fid)
        if not ids or not views:
            errors.append('At least one feature and view required')
    except (KeyError, TypeError, ValueError, OSError) as error:
        errors.append(str(error))
    status = 'invalid-or-stale' if errors else 'needs-revision' if blockers else 'not-reviewed' if pending else 'record-complete-with-differences' if differences else 'record-complete'
    return {'status': status, 'errors': errors, 'criticalDifferences': blockers, 'unverified': pending, 'differences': differences,
            'visualQuality': 'MANUAL_ASSESSMENT_ONLY', 'scope': 'Checks declared evidence and hashes; does not inspect image content or certify fidelity.'}

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='command', required=True)
    f = sub.add_parser('fingerprint'); f.add_argument('path', type=Path)
    c = sub.add_parser('check'); c.add_argument('--root', type=Path, required=True); c.add_argument('--record', type=Path, required=True); c.add_argument('--out', type=Path)
    a = p.parse_args()
    if a.command == 'fingerprint':
        print(tree_hash(a.path) if a.path.is_dir() else file_hash(a.path))
    else:
        result = review(a.root, json.loads(a.record.read_text(encoding='utf8')))
        output = json.dumps(result, ensure_ascii=False, indent=2)
        if a.out:
            a.out.parent.mkdir(parents=True, exist_ok=True); a.out.write_text(output, encoding='utf8')
        print(output)
        raise SystemExit(0 if result['status'].startswith('record-complete') else 1)
