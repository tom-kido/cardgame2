// Minimal static file server to serve the project root for Playwright
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = process.cwd();

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  try {
    const urlNoQuery = (req.url || '/').split('?')[0];
    let urlPath = decodeURIComponent(urlNoQuery);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(root, urlPath);
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      res.end(data);
    });
  } catch (e) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`[serve] Listening on http://localhost:${port}`);
});

