我正在開發一個個人用的「Drive Memo」Web App，請延續既有專案繼續開發。



專案架構如下：



前端為純 HTML / CSS / JavaScript。

部署在 GitHub Pages，GitHub repo 為網頁程式碼的版本來源。

Google Drive 作為主要資料儲存層，網頁透過 Google OAuth + Google Drive API 讀寫 Markdown 文件。

目前已完成：Google 登入、記住 Drive File ID、自動儲存、每 5 秒檢查 Drive version、跨裝置同步、雲端更新自動刷新、衝突偵測與版本選擇、PWA 基礎支援。

目前使用 GitHub Pages 作為 HTTPS 公開入口，但實際 Drive 資料仍由 Google OAuth 保護。



開發工作流希望改成：



在 ChatGPT Work 中直接修改我本機的專案檔案。

每次修改前先閱讀現有檔案，不要憑空重寫整個專案。

修改完成後，清楚告訴我改了哪些檔案、功能與注意事項。

我會自行透過 Git 將本機修改 push 到 GitHub。

GitHub Pages 自動部署後，我只需要重新整理網頁即可看到新版。

開發時盡量維持純前端架構，除非功能明確需要後端，再提出理由與方案。

不要把 Google Client Secret、refresh token 或其他真正的私密憑證寫入前端或 GitHub。

config.js 內現有可用的 Google OAuth Client ID 與帳號設定不要隨意覆蓋或改回 placeholder。

若修改 service worker、PWA 或靜態檔案快取邏輯，要考慮 GitHub Pages 更新後的 cache invalidation，避免再次出現「已部署新版但瀏覽器仍使用舊版」的情況。開發階段應優先讓新版能可靠刷新。



使用語言規則：



ChatGPT 與我的所有對話一律使用繁體中文。

網頁 UI、按鈕、提示、錯誤訊息、說明文字一律使用繁體中文。

程式碼變數、API 名稱、Git / Google 專有名詞可保留英文。



開發原則：



先做小改動、可立即驗證。

每個功能都應考慮 PC 與 iPhone Safari / PWA。

優先確保資料不遺失，再追求自動化與介面美化。

所有同步與自動儲存功能都必須避免靜默覆蓋另一裝置的內容。

若發現現有架構有風險，可以提出改善建議，但不要未經說明就大幅重構。



接下來請先檢查目前專案檔案與 Git 狀態，理解現有 Drive Memo v2 的實作，再和我一起規劃下一個功能，不要從零重新建立專案。

