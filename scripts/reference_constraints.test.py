import copy
import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('reference_constraints', HERE/'reference_constraints.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReferenceConstraintsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='wireframe-reference-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.image = self.root/'source.png'
        Image.new('RGB', (64, 48), 'white').save(self.image)
        self.doc = {'schema': 'wireframe-reference/1', 'units': 'm',
                    'sources': [{'id': 'source', 'path': 'source.png', 'sha256': module.sha(self.image), 'size': [64, 48]}],
                    'views': {'top': {'source': 'source', 'projection': 'orthographic', 'calibrated': True,
                                      'registrationBasis': 'Synthetic calibration independent of generated model',
                                      'camera': {'direction': [0, 0, 1], 'up': [0, 1, 0], 'center': [0, 0, 0], 'span': 2},
                                      'landmarks': [{'probe': 'corner', 'uv': [0.1, 0.2], 'tolerance': .02}]}},
                    'dimensions': [{'id': 'width', 'axis': 'x', 'measure': 'size', 'expected': 1,
                                    'tolerance': .01, 'source': 'source', 'basis': 'Synthetic annotation', 'evidence': 'annotated'}]}

    def test_valid_record(self):
        self.assertEqual(module.validate(self.doc, self.root), [])

    def test_changed_source_is_detected(self):
        Image.new('RGB', (64, 48), 'red').save(self.image)
        self.assertTrue(any('hash changed' in e for e in module.validate(self.doc, self.root)))

    def test_uncertain_projection_cannot_claim_calibration(self):
        self.doc['views']['top']['projection'] = 'unknown'
        self.assertTrue(any('Landmark comparison' in e for e in module.validate(self.doc, self.root)))

    def test_bad_coordinates_and_missing_basis_are_detected(self):
        self.doc['views']['top']['landmarks'][0]['uv'] = [1.2, .3]
        self.doc['dimensions'][0]['basis'] = ''
        self.assertEqual(len(module.validate(self.doc, self.root)), 2)

    def test_crop_does_not_escape_source(self):
        self.doc['views']['top']['region'] = [10, 0, 64, 48]
        self.assertTrue(any('outside source' in e for e in module.validate(self.doc, self.root)))

    def test_init_preserves_existing_record(self):
        target = self.root/'record.json'
        import sys
        command = [sys.executable, str(HERE/'reference_constraints.py'), 'init', '--image', 'source='+str(self.image), '--out', str(target)]
        self.assertEqual(subprocess.run(command, capture_output=True).returncode, 0)
        before = target.read_bytes()
        self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)
        self.assertEqual(target.read_bytes(), before)

    def test_malformed_fields_fail_without_masking_other_errors(self):
        self.doc['views']['top']['source'] = []
        self.doc['views']['top']['landmarks'] = None
        self.doc['dimensions'][0]['id'] = []
        self.doc['dimensions'][0]['source'] = []
        self.assertGreaterEqual(len(module.validate(self.doc, self.root)), 4)

    @unittest.skipUnless(os.environ.get('WIREFRAME_TEST_THREE'), 'Set WIREFRAME_TEST_THREE for packaging regression')
    def test_packaging_tracks_reference_and_extra_assets(self):
        import sys
        (self.root/'subject.js').write_text('export function buildScene(){}', encoding='utf8')
        extra = self.root/'custom.js'
        extra.write_text('export const value=1;', encoding='utf8')
        record = self.root/'record.json'
        record.write_text(json.dumps(self.doc), encoding='utf8')
        out = self.root/'web'
        command = [sys.executable, str(HERE/'prepare_web.py'), '--builder', str(self.root/'subject.js'), '--three', os.environ['WIREFRAME_TEST_THREE'], '--reference', str(record), '--extra', 'custom.js', '--out', str(out)]
        result = subprocess.run(command, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode('utf8'))
        first = json.loads((out/'preview-manifest.json').read_text(encoding='utf8'))
        self.assertIn('review.js', first['files'])
        self.assertIn('reference.json', first['files'])
        self.assertIn('custom.js', first['files'])
        self.assertTrue(any(k.startswith('references/') for k in first['files']))
        extra.write_text('export const value=2;', encoding='utf8')
        self.assertEqual(subprocess.run(command, capture_output=True).returncode, 0)
        second = json.loads((out/'preview-manifest.json').read_text(encoding='utf8'))
        self.assertNotEqual(first['id'], second['id'])
        self.assertEqual(second['files']['custom.js'], module.sha(extra))
        command[command.index('custom.js')] = '../outside.js'
        self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)


if __name__ == '__main__':
    unittest.main()
