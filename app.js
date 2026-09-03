let accessToken = null;
let tokenClient = null;

const $ = (id) => document.getElementById(id);
const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");
const loadBtn = $("loadBtn");
const saveBtn = $("saveBtn");
const editor = $("editor");
const preview = $("preview");
const statusEl = $("status");
const identityEl = $("identity");
const fileIdEl = $("fileId");

function setStatus(text, type="") {
  statusEl.textContent = text;
  statusEl.className = type;
}

function renderPreview() {
  const text = editor.value || "";
  preview.innerHTML = window.marked ? marked.parse(text) : `<pre>${escapeHtml(text)}</pre>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

async function waitForGoogleIdentity() {
  for (let i = 0; i < 100; i++) {
    if (window.google?.accounts?.oauth2) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error("Google Identity Services 未载入");
}

async function initAuth() {
  await waitForGoogleIdentity();

  const clientId = window.APP_CONFIG?.GOOGLE_CLIENT_ID || "";
  if (!clientId || clientId.startsWith("PASTE_")) {
    setStatus("请先在 config.js 填入 Google OAuth Client ID。", "err");
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    // Prototype 为了可以直接用既有 Drive File ID，先使用 drive scope。
    // 正式版建议收窄权限，例如 drive.file + Picker。
    scope: "openid email https://www.googleapis.com/auth/drive",
    callback: async (resp) => {
      if (resp.error) {
        setStatus(`登入失败：${resp.error}`, "err");
        return;
      }
      accessToken = resp.access_token;

      try {
        const me = await fetchJson("https://www.googleapis.com/oauth2/v3/userinfo");
        const allowed = (window.APP_CONFIG?.ALLOWED_EMAIL || "").trim().toLowerCase();

        if (allowed && me.email?.toLowerCase() !== allowed) {
          accessToken = null;
          setStatus(`帐号 ${me.email} 不在允许名单。`, "err");
          identityEl.textContent = "";
          return;
        }

        identityEl.textContent = me.email ? `已登入：${me.email}` : "已登入";
        loginBtn.disabled = true;
        logoutBtn.disabled = false;
        loadBtn.disabled = false;
        saveBtn.disabled = false;
        setStatus("登入成功。请贴上 Google Drive 文件的 File ID。", "ok");
      } catch (err) {
        accessToken = null;
        setStatus(`读取帐号资料失败：${err.message}`, "err");
      }
    }
  });
}

async function fetchJson(url, options={}) {
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const res = await fetch(url, {...options, headers});
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0,300)}`);
  }
  return res.json();
}

async function loadFile() {
  const fileId = fileIdEl.value.trim();
  if (!fileId) return setStatus("请先输入 File ID。", "err");

  setStatus("读取中…");
  try {
    const meta = await fetchJson(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime`
    );

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      {headers:{Authorization:`Bearer ${accessToken}`}}
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

    editor.value = await res.text();
    renderPreview();
    setStatus(`已读取：${meta.name} ｜ 最后修改 ${meta.modifiedTime}`, "ok");
    localStorage.setItem("driveMemoFileId", fileId);
  } catch (err) {
    setStatus(`读取失败：${err.message}`, "err");
  }
}

async function saveFile() {
  const fileId = fileIdEl.value.trim();
  if (!fileId) return setStatus("请先输入 File ID。", "err");

  setStatus("写回中…");
  try {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
      {
        method:"PATCH",
        headers:{
          Authorization:`Bearer ${accessToken}`,
          "Content-Type":"text/markdown; charset=utf-8"
        },
        body: editor.value
      }
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const result = await res.json();
    renderPreview();
    setStatus(`写回成功。File ID：${result.id || fileId}`, "ok");
  } catch (err) {
    setStatus(`写回失败：${err.message}`, "err");
  }
}

loginBtn.addEventListener("click", () => {
  if (!tokenClient) return setStatus("OAuth 尚未初始化。请检查 config.js。", "err");
  tokenClient.requestAccessToken({prompt:"consent"});
});

logoutBtn.addEventListener("click", () => {
  if (accessToken) google.accounts.oauth2.revoke(accessToken);
  accessToken = null;
  identityEl.textContent = "";
  loginBtn.disabled = false;
  logoutBtn.disabled = true;
  loadBtn.disabled = true;
  saveBtn.disabled = true;
  setStatus("已登出。");
});

loadBtn.addEventListener("click", loadFile);
saveBtn.addEventListener("click", saveFile);
editor.addEventListener("input", renderPreview);

window.addEventListener("DOMContentLoaded", async () => {
  fileIdEl.value = localStorage.getItem("driveMemoFileId") || "";
  renderPreview();
  try { await initAuth(); } catch (err) { setStatus(err.message, "err"); }
});
