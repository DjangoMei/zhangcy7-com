import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createNetServer } from "node:net";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const HOST = process.env.HOST || "127.0.0.1";
const START_PORT = Number(process.env.PORT || 3010);
const BLOCKED_PORTS = new Set([3000, 4173, 8787]);
const ASSET_CDN = "https://djangomei.github.io/zhangcy7-com";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function cacheControlFor(extension) {
  if (extension === ".woff2") return "public, max-age=31536000, immutable";
  if ([".png", ".jpg", ".jpeg", ".svg", ".webp"].includes(extension)) return "public, max-age=604800";
  if ([".pdf", ".docx"].includes(extension)) return "public, max-age=86400";
  return "no-cache";
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const probe = createNetServer();
    probe.unref();
    probe.once("error", () => resolve(false));
    probe.listen(port, HOST, () => probe.close(() => resolve(true)));
  });
}

async function findPort() {
  for (let port = START_PORT; port < 3100; port += 1) {
    if (!BLOCKED_PORTS.has(port) && (await portIsFree(port))) return port;
  }
  throw new Error("No available port found between 3010 and 3099.");
}

function resolveRequestPath(requestUrl = "/") {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = normalize(join(ROOT, requested));
  return resolved.startsWith(ROOT) ? resolved : null;
}

const port = await findPort();
const server = createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", "http://localhost");
  const filePath = resolveRequestPath(requestUrl.pathname);
  if (!filePath) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) throw new Error("Not a file");
    const extension = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension];
    if (!contentType) {
      response.writeHead(415).end("Unsupported media type");
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { "Allow": "GET, HEAD" }).end("Method not allowed");
      return;
    }

    const headers = {
      "Content-Type": contentType,
      "Cache-Control": cacheControlFor(extension),
      "Content-Length": stats.size,
      "Last-Modified": stats.mtime.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    };

    if (extension === ".pdf") headers["Accept-Ranges"] = "bytes";

    const range = extension === ".pdf" ? request.headers.range : null;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        response.writeHead(416, { ...headers, "Content-Range": `bytes */${stats.size}`, "Content-Length": 0 }).end();
        return;
      }

      let start;
      let end;
      if (!match[1]) {
        const suffixLength = Number(match[2]);
        start = Math.max(0, stats.size - suffixLength);
        end = stats.size - 1;
      } else {
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), stats.size - 1) : stats.size - 1;
      }

      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= stats.size) {
        response.writeHead(416, { ...headers, "Content-Range": `bytes */${stats.size}`, "Content-Length": 0 }).end();
        return;
      }

      response.writeHead(206, {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${stats.size}`,
        "Content-Length": end - start + 1,
      });
      if (request.method === "HEAD") response.end();
      else createReadStream(filePath, { start, end }).pipe(response);
      return;
    }

    response.writeHead(200, headers);
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath).pipe(response);
  } catch {
    if (requestUrl.pathname.startsWith("/assets/")) {
      response.writeHead(302, {
        Location: `${ASSET_CDN}${requestUrl.pathname}`,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      });
      response.end();
      return;
    }
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("页面不存在");
  }
});

server.listen(port, HOST, () => {
  console.log(`Homepage ready at http://${HOST}:${port}/`);
});
