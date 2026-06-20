const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const distDir = path.join(__dirname, "dist");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const stream = fs.createReadStream(filePath);

  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": getCacheControl(filePath)
  });

  stream.pipe(res);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500);
    }
    res.end("Server error");
  });
}

function getCacheControl(filePath) {
  const fileName = path.basename(filePath);
  if (["index.html", "sw.js", "registerSW.js", "manifest.webmanifest"].includes(fileName)) {
    return "no-cache";
  }
  return "public, max-age=31536000, immutable";
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const cleanPath = decodeURIComponent(url.pathname.split("?")[0]);
    const requestedPath = cleanPath === "/" ? "/index.html" : cleanPath;
    const filePath = path.resolve(distDir, `.${requestedPath}`);

    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(res, filePath);
      return;
    }

    sendFile(res, path.join(distDir, "index.html"));
  } catch (error) {
    res.writeHead(500);
    res.end("Server error");
  }
});

server.listen(port, host, () => {
  console.log("");
  console.log("DANAPETA server aktif.");
  console.log(`Local : http://localhost:${port}`);
  console.log(`Public: http://IP-VPS-KAMU:${port}`);
  console.log("");
  console.log("Biarkan window ini tetap terbuka selama program ingin diakses.");
});
