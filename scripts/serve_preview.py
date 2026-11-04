"""Loopback preview with exclusive binding; never attach to or stop another project."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import webbrowser

class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Live editing must not reuse an older imported shader/module or stylesheet.
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

class LocalServer(ThreadingHTTPServer):
    allow_reuse_address = False
    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

def bind_preview(root, port=8875, attempts=50):
    root = Path(root).resolve()
    if not (root / 'index.html').is_file():
        raise ValueError('Preview root must contain index.html')
    if not 1 <= port <= 65535 or attempts < 1:
        raise ValueError('Invalid port or attempts')
    handler = partial(PreviewHandler, directory=str(root))
    for candidate in range(port, min(port + attempts, 65536)):
        try:
            return LocalServer(('127.0.0.1', candidate), handler)
        except OSError as error:
            if error.errno not in (13, 48, 98, 10013, 10048):
                raise
    raise OSError('No free preview port in the selected range')

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, required=True)
    p.add_argument('--port', type=int, default=8875)
    p.add_argument('--open', action='store_true')
    a = p.parse_args()
    server = bind_preview(a.root, a.port)
    url = f'http://127.0.0.1:{server.server_port}/'
    print(url, flush=True)
    print('Keep this window open. Ctrl+C stops this preview only.', flush=True)
    if a.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
