import test from "node:test";
import assert from "node:assert/strict";
import { WeDriveClient } from "../src/wedrive-client.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("使用後端憑證取得 token，並列出微盤檔案", async () => {
  const requests = [];
  const client = new WeDriveClient({
    corpId: "ww-test",
    corpSecret: "secret-test",
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      if (String(url).includes("/gettoken")) return jsonResponse({ errcode: 0, access_token: "token-test", expires_in: 7200 });
      return jsonResponse({ errcode: 0, file_list: { item: [{ fileid: "f1", file_name: "memo.md" }] } });
    }
  });

  const result = await client.listFiles({ spaceId: "space-1", fatherId: "folder-1" });
  assert.equal(result.file_list.item[0].file_name, "memo.md");
  assert.match(requests[0].url, /corpid=ww-test/);
  assert.match(requests[0].url, /corpsecret=secret-test/);
  assert.doesNotMatch(requests[1].options.body, /secret-test/);
  assert.match(requests[1].url, /access_token=token-test/);
});
test("連續呼叫會重用尚未到期的 token", async () => {
  let tokenCalls = 0;
  const client = new WeDriveClient({
    corpId: "ww-test",
    corpSecret: "secret-test",
    fetchImpl: async url => {
      if (String(url).includes("/gettoken")) {
        tokenCalls += 1;
        return jsonResponse({ errcode: 0, access_token: "token-test", expires_in: 7200 });
      }
      return jsonResponse({ errcode: 0, file_list: { item: [] } });
    }
  });
  await client.listFiles({ spaceId: "space-1", fatherId: "folder-1" });
  await client.listFiles({ spaceId: "space-1", fatherId: "folder-1" });
  assert.equal(tokenCalls, 1);
});

test("寫入內容會在後端轉成 Base64", async () => {
  let uploadPayload;
  const client = new WeDriveClient({
    corpId: "ww-test",
    corpSecret: "secret-test",
    fetchImpl: async (url, options) => {
      if (String(url).includes("/gettoken")) return jsonResponse({ errcode: 0, access_token: "token-test", expires_in: 7200 });
      uploadPayload = JSON.parse(options.body);
      return jsonResponse({ errcode: 0, fileid: "new-file" });
    }
  });
  const result = await client.uploadText({ spaceId: "space-1", fatherId: "folder-1", fileName: "test.txt", content: "測試" });
  assert.equal(result.fileid, "new-file");
  assert.equal(Buffer.from(uploadPayload.file_base64_content, "base64").toString("utf8"), "測試");
});

test("企業微信錯誤碼不會被當成成功", async () => {
  const client = new WeDriveClient({
    corpId: "bad",
    corpSecret: "bad",
    fetchImpl: async () => jsonResponse({ errcode: 40013, errmsg: "invalid corpid" })
  });
  await assert.rejects(() => client.getAccessToken(), /40013/);
});
