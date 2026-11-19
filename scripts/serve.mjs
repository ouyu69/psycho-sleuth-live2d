import {createServer} from 'node:http';
import {createReadStream, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, extname, sep} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8', '.css':'text/css', '.mjs':'text/javascript', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.moc3':'application/octet-stream'};
createServer((req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    // Also exercise Pages-style project URLs locally.
    let pathname = decodeURIComponent(url.pathname).replace(/^\/live2d-viewer(?=\/)/, '');
    if (pathname.endsWith('/')) pathname += 'index.html';
    const path = resolve(root, '.' + pathname);
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) throw Error('Invalid path');
    const stat = statSync(path);
    if (!stat.isFile()) throw Error('Not a file');
    res.writeHead(200, {'Content-Type':types[extname(path)] || 'application/octet-stream', 'Content-Length':stat.size, 'Cache-Control':'no-cache'});
    if (req.method === 'HEAD') res.end(); else createReadStream(path).pipe(res);
  } catch {
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Live2D viewer: http://127.0.0.1:${port}/live2d-viewer/`));
