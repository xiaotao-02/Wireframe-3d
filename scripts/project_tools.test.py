"""Regression tests for source snapshots, preview port isolation and evidence freshness."""
import copy
import tempfile
import unittest
from pathlib import Path
from http.server import SimpleHTTPRequestHandler
import zipfile
from project_snapshot import snapshot
from check_reference import review,tree_hash,file_hash
from serve_preview import bind_preview,LocalServer

class ProjectTools(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.source=self.root/'project';self.source.mkdir();(self.source/'index.html').write_text('<p>fixture</p>',encoding='utf8')
    def tearDown(self):
        self.temp.cleanup()
    def test_snapshot_is_complete_and_preserves_previous_versions(self):
        a=snapshot(self.source,self.root/'backups');(self.source/'index.html').write_text('updated',encoding='utf8');b=snapshot(self.source,self.root/'backups')
        self.assertNotEqual(a['archive'],b['archive']);self.assertTrue(Path(a['archive']).exists())
        with zipfile.ZipFile(b['archive']) as z:
            name=Path(b['directory']).name;self.assertEqual(z.read(name+'/index.html'),b'updated')
    def test_concurrent_edit_leaves_only_unverified_partial(self):
        with self.assertRaisesRegex(RuntimeError,'changed'):
            snapshot(self.source,self.root/'backups',before_verify=lambda:(self.source/'index.html').write_text('race',encoding='utf8'))
        self.assertEqual(list((self.root/'backups').glob('*.zip')),[])
        self.assertEqual(len(list((self.root/'backups').glob('*.partial'))),1)
    def test_snapshot_cannot_recurse_into_itself(self):
        with self.assertRaises(ValueError):snapshot(self.source,self.source/'backups')
    def test_preview_does_not_share_an_occupied_port(self):
        occupied=LocalServer(('127.0.0.1',0),SimpleHTTPRequestHandler)
        try:
            server=bind_preview(self.source,occupied.server_port,10)
            try:self.assertNotEqual(server.server_port,occupied.server_port);self.assertEqual(server.server_address[0],'127.0.0.1')
            finally:server.server_close()
        finally:occupied.server_close()
    def fixture(self):
        (self.root/'reference.png').write_bytes(b'reference fixture');(self.root/'actual.png').write_bytes(b'actual fixture')
        digest=tree_hash(self.source)
        return {'build':{'path':'project','sha256':digest},'views':[{'id':'hero','buildSha256':digest,'state':{'time':0,'projection':'orthographic'},'alignment':{'status':'checked','note':'Recorded comparison alignment'},'reference':{'path':'reference.png','sha256':file_hash(self.root/'reference.png')},'actual':{'path':'actual.png','sha256':file_hash(self.root/'actual.png')}}],
                'features':[{'id':'opening','critical':True,'source':'reference view','implementation':'actual bore mesh','views':['hero'],'status':'matched','note':'Reviewer recorded the visible opening'}]}
    def test_completed_record_does_not_claim_visual_pass(self):
        r=review(self.root,self.fixture());self.assertEqual(r['status'],'record-complete');self.assertEqual(r['visualQuality'],'MANUAL_ASSESSMENT_ONLY')
    def test_geometry_change_invalidates_old_screenshot_record(self):
        r=self.fixture();(self.source/'index.html').write_text('changed geometry',encoding='utf8');self.assertEqual(review(self.root,r)['status'],'invalid-or-stale')
    def test_image_change_is_detected(self):
        r=self.fixture();(self.root/'actual.png').write_bytes(b'replaced screenshot');self.assertEqual(review(self.root,r)['status'],'invalid-or-stale')
    def test_critical_difference_blocks_record_completion(self):
        r=self.fixture();r['features'][0]['status']='different';self.assertEqual(review(self.root,r)['status'],'needs-revision')
    def test_pending_alignment_and_missing_feature_views_cannot_pass(self):
        r=self.fixture();r['views'][0]['alignment']['status']='unverified';self.assertEqual(review(self.root,r)['status'],'not-reviewed')
        r=self.fixture();r['features'][0]['views']=[];self.assertEqual(review(self.root,r)['status'],'invalid-or-stale')
    def test_documented_minor_difference_is_not_hidden(self):
        r=self.fixture();r['features'][0].update(critical=False,status='different');result=review(self.root,r);self.assertEqual(result['status'],'record-complete-with-differences');self.assertEqual(result['differences'],['opening'])

if __name__=='__main__':unittest.main(verbosity=2)
