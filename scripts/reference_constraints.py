"""Record reference provenance and validate declared constraints. Never infers shape or certifies fidelity."""
import argparse
import hashlib
import json
import math
from pathlib import Path


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def vector(value, count):
    return isinstance(value, list) and len(value) == count and all(finite(x) for x in value)


def image_info(path):
    from PIL import Image
    with Image.open(path) as image:
        return list(image.size)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate(document, base):
    errors = []
    def require(test, reason):
        if not test:
            errors.append(reason)
        return test
    if not require(isinstance(document, dict), 'Document must be an object'):
        return errors
    require(document.get('schema') == 'wireframe-reference/1', 'Unknown reference schema')
    require(document.get('units') == 'm', 'Geometry constraints use meters')
    sources = document.get('sources', [])
    if not require(isinstance(sources, list) and bool(sources), 'At least one source is required'):
        sources = []
    known = {}
    for s in sources:
        if not require(isinstance(s, dict) and isinstance(s.get('id'), str) and bool(s['id']), 'Source needs an id'):
            continue
        require(s['id'] not in known, 'Duplicate source id: ' + s['id'])
        known[s['id']] = s
        if not require(isinstance(s.get('path'), str), 'Source needs a path'):
            continue
        path = (base / s['path']).resolve()
        if not require(path.is_file(), 'Missing source: ' + str(path)):
            continue
        require(sha(path) == s.get('sha256'), 'Source hash changed: ' + s['id'])
        try:
            require(image_info(path) == s.get('size'), 'Source pixel dimensions changed: ' + s['id'])
        except Exception as exc:
            errors.append('Unreadable source: ' + str(exc))
    views = document.get('views', {})
    if not require(isinstance(views, dict), 'views must be an object'):
        views = {}
    for name, view in views.items():
        if not require(isinstance(view, dict), 'Invalid view: ' + name):
            continue
        source_id = view.get('source')
        source = known.get(source_id) if isinstance(source_id, str) else None
        require(source is not None, 'Unknown view source: ' + name)
        projection = view.get('projection')
        require(projection in ('orthographic', 'perspective', 'unknown'), 'Declare source projection: ' + name)
        region = view.get('region')
        if region is not None and require(vector(region, 4), 'region must be [x,y,width,height] pixels'):
            if source and vector(source.get('size'), 2):
                w, h = source['size']
                require(region[0] >= 0 and region[1] >= 0 and region[2] > 0 and region[3] > 0 and region[0]+region[2] <= w and region[1]+region[3] <= h, 'region outside source: ' + name)
        camera = view.get('camera', {})
        if not require(isinstance(camera, dict), 'Invalid camera: ' + name):
            continue
        d, u = camera.get('direction'), camera.get('up')
        if require(vector(d, 3) and vector(u, 3), 'Camera needs direction/up: ' + name):
            cross = [d[1]*u[2]-d[2]*u[1], d[2]*u[0]-d[0]*u[2], d[0]*u[1]-d[1]*u[0]]
            require(sum(x*x for x in cross) > 1e-12, 'Degenerate camera basis: ' + name)
        if 'center' in camera or 'span' in camera:
            require(vector(camera.get('center'), 3) and finite(camera.get('span')) and camera['span'] > 0, 'Fixed camera needs center and positive span: ' + name)
        calibrated = view.get('calibrated', False)
        require(isinstance(calibrated, bool), 'calibrated must be boolean')
        if calibrated:
            require(projection == 'orthographic' and 'span' in camera and bool(view.get('registrationBasis')), 'Landmark comparison requires orthographic source, fixed framing and registrationBasis: ' + name)
        landmarks = view.get('landmarks', [])
        if not require(isinstance(landmarks, list), 'landmarks must be an array: ' + name):
            landmarks = []
        for mark in landmarks:
            if not require(isinstance(mark, dict), 'Invalid landmark'):
                continue
            require(isinstance(mark.get('probe'), str) and bool(mark['probe']), 'Landmark needs model probe id')
            require(vector(mark.get('uv'), 2) and all(0 <= n <= 1 for n in mark['uv']), 'Landmark UV must be normalized to the selected source region')
            require(finite(mark.get('tolerance')) and mark['tolerance'] >= 0, 'Landmark needs normalized tolerance')
    dimensions = document.get('dimensions', [])
    if not require(isinstance(dimensions, list), 'dimensions must be an array'):
        dimensions = []
    ids = set()
    for c in dimensions:
        if not require(isinstance(c, dict), 'Invalid dimension'):
            continue
        if require(isinstance(c.get('id'), str) and bool(c['id']) and c['id'] not in ids, 'Missing/duplicate dimension id'):
            ids.add(c['id'])
        require(c.get('axis') in ('x', 'y', 'z') and c.get('measure') in ('size', 'min', 'max'), 'Dimension needs axis and size/min/max measure')
        require(finite(c.get('expected')) and finite(c.get('tolerance')) and c['tolerance'] >= 0, 'Dimension needs finite expected value and tolerance')
        require(isinstance(c.get('source'), str) and c['source'] in known and bool(c.get('basis')), 'Dimension needs source and independent basis')
        require(c.get('evidence') in ('annotated', 'measured', 'estimated'), 'Dimension needs annotated/measured/estimated evidence')
        require('parts' not in c or isinstance(c['parts'], list) and all(isinstance(x, str) for x in c['parts']), 'Dimension parts must be IDs')
    return errors


def main():
    p = argparse.ArgumentParser(description=__doc__)
    commands = p.add_subparsers(dest='command', required=True)
    init = commands.add_parser('init')
    init.add_argument('--image', action='append', required=True, help='id=path; repeat for source images')
    init.add_argument('--out', type=Path, required=True)
    check = commands.add_parser('validate')
    check.add_argument('file', type=Path)
    args = p.parse_args()
    if args.command == 'init':
        if args.out.exists():
            raise SystemExit('Refusing to overwrite an existing reference record')
        sources = []
        for item in args.image:
            name, path = item.split('=', 1)
            path = Path(path).resolve()
            sources.append({'id': name, 'path': str(path), 'size': image_info(path), 'sha256': sha(path)})
        doc = {'schema': 'wireframe-reference/1', 'units': 'm', 'sources': sources, 'views': {}, 'dimensions': [], 'features': [], 'visualReview': 'NOT_RUN'}
        errors = validate(doc, args.out.parent)
        if errors:
            raise SystemExit('\n'.join(errors))
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(doc, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
        print(f'DRAFT: {args.out}; annotate views, features and independent dimensions before modeling')
    else:
        doc = json.loads(args.file.read_text(encoding='utf8'))
        errors = validate(doc, args.file.parent)
        print(json.dumps({'status': 'fail' if errors else 'pass', 'errors': errors, 'scope': 'Source integrity and constraint structure only', 'referenceFidelity': 'NOT_ASSESSED'}, ensure_ascii=False, indent=2))
        raise SystemExit(bool(errors))


if __name__ == '__main__':
    main()
