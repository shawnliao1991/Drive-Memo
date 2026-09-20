import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WeDriveClient } from "./src/wedrive-client.mjs";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const port = Number(process.env.PORT || 8787);
const config = {
  corpId: process.env.WEDRIVE_CORP_ID || "",
  corpSecret: process.env.WEDRIVE_CORP_SECRET || "",
  spaceId: process.env.WEDRIVE_SPACE_ID || "",
  fatherId: process.env.WEDRIVE_FATHER_ID || "",
  userId: process.env.WEDRIVE_USER_ID || "",
  allowWrite: process.env.WEDRIVE_ALLOW_WRITE === "true"
};
const client = new WeDriveClient(config);

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/api/status") {
      return json(response, 200, {
        configured: Boolean(config.corpId && config.corpSecret && config.spaceId && config.fatherId),
        writeEnabled: config.allowWrite,
        serverSideSecret: true
      });
    }

    if (request.method === "POST" && request.url === "/api/probe") {
      const result = await client.listFiles(config);
      const files = result.file_list?.item || [];
      return json(response, 200, {
        ok: true,
        count: files.length,
        hasMore: Boolean(result.has_more),
        files: files.map(({ fileid, file_name, file_size, mtime, md5, sha, file_type }) => ({
          fileId: fileid,
          name: file_name,
          size: file_size,
          modifiedTime: mtime,
          md5,
          sha,
          type: file_type
        }))
      });
    }

    if (request.method === "POST" && request.url === "/api/upload-test") {
      if (!config.allowWrite) {
        return json(response, 403, { error: "寫入測試已鎖定；請在後端設定 WEDRIVE_ALLOW_WRITE=true" });
      }
      const body = await readJsonBody(request);
      const stamp = new Date().toISOString().replaceAll(":", "-");
      const content = String(body.content || `WeDrive WEB 同步測試\n${new Date().toISOString()}\n`);
      const uploaded = await client.uploadText({
        ...config,
        fileName: `drive-memo-web-sync-${stamp}.txt`,
        content
      });
      return json(response, 200, { ok: true, fileId: uploaded.fileid });
    }

    if (request.method !== "GET") return json(response, 404, { error: "Not found" });
    await serveStatic(request.url, response);
  } catch (error) {
    json(response, error.code === "BODY_TOO_LARGE" ? 413 : 502, {
      error: error.message || String(error),
      code: error.code || null
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`微盤 WEB 同步驗證頁：http://127.0.0.1:${port}`);
});

async function serveStatic(url, response) {
  const pathname = new URL(url, "http://127.0.0.1").pathname;
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);
  if (!filePath.startsWith(root)) return json(response, 403, { error: "Forbidden" });
  try {
    const content = await readFile(filePath);
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
    response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(content);
  } catch {
    json(response, 404, { error: "Not found" });
  }
}
async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) {
      const error = new Error("請求內容過大");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}
