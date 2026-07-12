const http = require('node:http');
const { createReadStream, stat } = require('node:fs');
const { extname, isAbsolute, join, normalize, relative, sep } = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY'
};

http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { ...SECURITY_HEADERS, Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }

  let requestPath;
  try {
    requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
  } catch {
    response.writeHead(400, SECURITY_HEADERS).end('Bad request');
    return;
  }
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const filePath = normalize(join(ROOT, relativePath));
  const pathFromRoot = relative(ROOT, filePath);

  if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    response.writeHead(403, SECURITY_HEADERS).end('Forbidden');
    return;
  }

  stat(filePath, (error, info) => {
    if (error || !info.isFile()) {
      response.writeHead(404, SECURITY_HEADERS).end('Not found');
      return;
    }
    response.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream' });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    const stream = createReadStream(filePath);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Sfera działa na http://127.0.0.1:${PORT}`);
});
