const http = require('http');

const PORT = Number(process.env.PORT) || 3000;

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Pitchin</title>
  </head>
  <body>
    <button type="button" aria-label="Search" title="Search">&#128269;</button>
    <button type="button" aria-label="Settings" title="Settings">&#9881;</button>
  </body>
</html>`;

http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page);
  })
  .listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
