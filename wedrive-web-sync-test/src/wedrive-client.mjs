const DEFAULT_BASE_URL = "https://qyapi.weixin.qq.com";

function requireValue(value, name) {
  if (!value) throw new Error(`缺少後端環境變數 ${name}`);
  return value;
}
export class WeDriveClient {
  constructor({ corpId, corpSecret, fetchImpl = fetch, baseUrl = DEFAULT_BASE_URL }) {
    this.corpId = corpId;
    this.corpSecret = corpSecret;
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl;
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  async getAccessToken() {
    if (this.token && Date.now() < this.tokenExpiresAt - 60_000) return this.token;

    const query = new URLSearchParams({
      corpid: requireValue(this.corpId, "WEDRIVE_CORP_ID"),
      corpsecret: requireValue(this.corpSecret, "WEDRIVE_CORP_SECRET")
    });
    const response = await this.fetchImpl(`${this.baseUrl}/cgi-bin/gettoken?${query}`);
    const result = await parseJson(response, "取得 access token");
    assertWeComSuccess(result, "取得 access token");
    if (!result.access_token) throw new Error("企業微信未回傳 access_token");

    this.token = result.access_token;
    this.tokenExpiresAt = Date.now() + Number(result.expires_in || 7200) * 1000;
    return this.token;
  }

  async post(path, payload) {
    const token = await this.getAccessToken();
    const response = await this.fetchImpl(
      `${this.baseUrl}${path}?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );
    const result = await parseJson(response, path);
    assertWeComSuccess(result, path);
    return result;
  }

  async listFiles({ spaceId, fatherId, start = 0, limit = 100 }) {
    return this.post("/cgi-bin/wedrive/file_list", {
      spaceid: requireValue(spaceId, "WEDRIVE_SPACE_ID"),
      fatherid: requireValue(fatherId, "WEDRIVE_FATHER_ID"),
      sort_type: 1,
      start,
      limit
    });
  }

  async fileInfo({ fileId }) {
    return this.post("/cgi-bin/wedrive/file_info", {
      fileid: requireValue(fileId, "fileId")
    });
  }

  async uploadText({ spaceId, fatherId, fileName, content }) {
    return this.post("/cgi-bin/wedrive/file_upload", {
      spaceid: requireValue(spaceId, "WEDRIVE_SPACE_ID"),
      fatherid: requireValue(fatherId, "WEDRIVE_FATHER_ID"),
      file_name: requireValue(fileName, "fileName"),
      file_base64_content: Buffer.from(String(content), "utf8").toString("base64")
    });
  }
}

async function parseJson(response, action) {
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`${action}回傳非 JSON 內容（HTTP ${response.status}）`);
  }
  if (!response.ok) throw new Error(`${action}失敗：HTTP ${response.status}`);
  return result;
}

function assertWeComSuccess(result, action) {
  if (Number(result.errcode || 0) !== 0) {
    const error = new Error(`${action}失敗：${result.errmsg || "未知錯誤"} (${result.errcode})`);
    error.code = result.errcode;
    throw error;
  }
}
