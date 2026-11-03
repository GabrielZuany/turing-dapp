// Servidor estático mínimo para o frontend (sem dependências extras).
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, "..", "frontend");
const ETHERS = path.join(__dirname, "..", "node_modules", "ethers", "dist", "ethers.umd.min.js");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const file =
      url === "/vendor/ethers.js"
        ? ETHERS
        : path.join(ROOT, path.normalize(url === "/" ? "/index.html" : url));

    if (file !== ETHERS && !file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`Frontend em http://localhost:${PORT}`));
