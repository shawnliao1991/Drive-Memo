我正在開發一個個人用的「Drive Memo」Web App，請延續既有專案繼續開發。



專案架構如下：



前端為純 HTML / CSS / JavaScript。

部署在 GitHub Pages，GitHub repo 為網頁程式碼的版本來源。

Google Drive 作為主要資料儲存層，網頁透過 Google OAuth + Google Drive API 讀寫 Markdown 文件。

目前已完成：Google 登入、記住 Drive File ID、自動儲存、快速操作儲存佇列、每 5 秒檢查 Drive version、跨裝置同步、雲端更新自動刷新、衝突偵測與版本選擇、同步 Debug 控制項、PWA 基礎支援。

目前使用 GitHub Pages 作為 HTTPS 公開入口，但實際 Drive 資料仍由 Google OAuth 保護。



程式碼固定分為三大模組：



1. 同步模組（sync.js）

負責 Google OAuth、Google Drive API、Drive File ID、內容下載與上傳、自動儲存佇列、Drive version 輪詢、跨裝置更新、衝突判定、版本選擇與瀏覽器備份。

同步模組保存 baseVersion、baseContent、dirty、saving、queued save、conflict 等同步狀態，並提供 Debug snapshot。快速連續操作時必須以內容快照依序儲存；雲端若只是回報本機上一批更新，不得誤判為跨裝置衝突。

同步模組透過 callback 與 UI 溝通，不直接產生主要畫面 HTML，也不負責解讀內容格式。



2. 內容模組（content.js）

負責取得與解析文件內容、內容分類、加入與管理內容，以及定義提供 UI 使用的資料格式。

目前內容格式版本為 v1：Markdown 正文是主要「筆記內容」分類；`DRIVE_MEMO_UI_STATE` 隱藏區塊保存跨裝置 Debug 控制項狀態。內容模組必須統一負責 parse、normalize、serialize、update 與 view model 轉換，其他模組不得各自重複解析這些格式。

未來新增分類、內容項目、排序或欄位時，優先在內容模組擴充格式與相容性，再交由 UI 呈現。



3. UI 模組（ui.js）

負責主界面、內容依分類呈現、Markdown 預覽、互動控制、狀態提示、登入按鈕、衝突對話框、Debug 測試界面，以及 PC / iPhone Safari / PWA 的操作體驗。

UI 模組只能透過內容模組讀寫文件格式，並透過同步模組讀寫 Drive；不要在 UI 事件內直接呼叫 Google Drive API。



模組依賴方向為：`ui.js → content.js + sync.js`。`content.js` 不依賴 DOM 或網路；`sync.js` 不依賴內容格式；三個檔案由 `index.html` 依序載入。維持傳統瀏覽器 namespace，確保 GitHub Pages 與本機 `file://` 預覽都可使用。根目錄 `app.js` 僅為舊版 HTML 快取的相容載入器，不可再放入應用功能。



開發工作流希望改成：



在 ChatGPT Work 中直接修改我本機的專案檔案。

每次修改前先閱讀現有檔案，不要憑空重寫整個專案。

修改完成後，清楚告訴我改了哪些檔案、功能與注意事項。

修改與測試完成後，ChatGPT Work 直接建立 Git commit 並 push 到 GitHub；除非我另有指示，不需等待我手動執行。

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

