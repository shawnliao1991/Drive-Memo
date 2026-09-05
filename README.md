# Drive Memo v2

## 新功能
- 首頁改為「牛馬日誌」，以今天、明天到未來一週的垂直時間軸整理 Todo 與 Done
- 每顆 Bullet 在展開前就顯示「事情／專案」主標題與「今天的 Action」副標題
- 支援紅、綠、藍、無色四級重要度，並可新增、編輯、完成、軟刪除與復原
- 過去未完成事項可半自動順延；同一項目同一天不會重複建立，紅／綠 Highlight 會在後續完成後轉灰
- Sync Debug 已移到獨立頁面，保留原始 Markdown 與六種跨裝置狀態控制
- 记住 Drive File ID
- 当前浏览器会话内记住 Google access token
- 停止输入 1.2 秒自动保存
- 前景页面每 5 秒只检查 Drive metadata
- version 改变时才下载正文
- 另一装置修改后自动刷新
- 本机与云端同时修改时显示差异并要求选择
- iPhone PWA / 加入主画面
- 页面切后台时停止轮询，回前景立即检查
- token 到期时要求重新连接，不把 refresh token 存进前端
- 「呈現」區提供 6 種可操作狀態：Checkbox、切換開關、單選、下拉選單、滑桿與短文字
- 互動狀態會寫入 Markdown 末端的 `DRIVE_MEMO_UI_STATE` 隱藏區塊，沿用 Drive 自動儲存與跨裝置同步
- 快速連續操作會依序儲存；Drive 稍晚回報上一批本機更新時不會誤判為跨裝置衝突

## 三大模組
- `sync.js`：OAuth、Drive API、自動儲存、版本輪詢與衝突保護
- `content.js`：牛馬日誌資料格式、Markdown 相容層、分類、順延規則及 UI view model
- `ui.js`：牛馬日誌首頁、Bullet 互動與獨立的 Sync Debug 界面
- `app.js`：只供舊版快取頁面轉接三大模組，不放應用功能

## GitHub Pages 升级
1. 上傳／覆蓋 index.html、app.js、sync.js、content.js、ui.js、manifest.webmanifest、sw.js 與三個 icon 檔案。
2. config.js 请填回你原本的 GOOGLE_CLIENT_ID 与 ALLOWED_EMAIL。
3. 保留：
   SYNC_INTERVAL_MS: 5000
   AUTOSAVE_DELAY_MS: 1200
4. Commit 后等 GitHub Pages 部署。
5. iPhone Safari 打开网站 → 分享 → 加入主画面。

## 登入状态
纯 GitHub Pages 无后端，不应该把长期 refresh token 放在 localStorage。
因此 v2 只把短期 access token 放 sessionStorage：
- 刷新页面通常不用重登
- 同一浏览器会话通常不用重登
- token 到期或浏览器结束会话后，点一次「连接 Google」

若未来要真正长期免登录，需要加一个小型 backend 安全保存 refresh token。

## 同步
每 5 秒只请求一次 metadata；version 没变就不下载正文。
输入停止 1.2 秒后自动保存，保存前会再确认 Drive version。
若本机有修改而云端 version 又改变，自动保存暂停并显示冲突。

冲突时：
- 使用云端版：本机旧版会先备份到浏览器 localStorage
- 保留本地：云端旧版先备份，再明确覆盖 Drive
- 暂不处理：保持冲突状态，自动保存暂停
