// 1) 到 Google Cloud Console 建立 Web OAuth Client ID
// 2) 把 http://localhost:8080 加入 Authorized JavaScript origins
// 3) 把 Client ID 填在这里
window.APP_CONFIG = {
  GOOGLE_CLIENT_ID: "44635016250-bu1kkuf8df5uqgdgk60fn56fe8fvr7pj.apps.googleusercontent.com",

  // Prototype 的 UI 限制。留空则不限制。
  // 注意：这只是前端限制，不应视为正式安全边界。
  ALLOWED_EMAIL: "shawnliao1991@gmail.com"
};
