const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  let filePath = path.join('/home/rajat/Downloads/PharmaOS/PharmaOS/dist', reqPath);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fallback to index.html for SPA router
      fs.readFile(path.join('/home/rajat/Downloads/PharmaOS/PharmaOS/dist', 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data2);
        }
      });
    } else {
      let ext = path.extname(filePath);
      let contentType = 'text/html';
      if (ext === '.js') contentType = 'application/javascript';
      else if (ext === '.css') contentType = 'text/css';
      else if (ext === '.json') contentType = 'application/json';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg') contentType = 'image/jpeg';
      else if (ext === '.ico') contentType = 'image/x-icon';
      else if (ext === '.ttf') contentType = 'font/ttf';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(8080, () => {
  console.log('Server running at http://localhost:8080/');
});
