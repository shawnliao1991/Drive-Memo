# Drive Memo v2

長期自動登入的 Google Cloud 託管版本與設定步驟見 [部署說明](server/DEPLOY.md)。GitHub Pages 仍使用原本短效登入；部署 Cloud Run 後須改用新網址。

## 新功能
- 日誌首頁以今天、明天到未來一週的精簡垂直時間軸整理待辦與 Done
- 原 Bullet 正名為 Action：一般 Action 可獨立存在，也可轉為某個專案底下的專案 Action
- 專案本身只有名稱、專案內容與狀態；日期和重要度只屬於 Action
- 介面採用接近 VS Code 的深色主題，讓日誌與專案管理維持一致視覺
- Action 主標題為「對象、做什麼」；專案 Action 以專案名為副標題，一般 Action 不顯示副標題。Action 細節獨立儲存，只在編輯畫面顯示。
- 專案 Action 編輯畫面另提供預設折疊的專案內容；專案列表預覽只展現內容第一階與未完成 Actions，圓點、父階層三角形及縮排與編輯器一致。
- 專案編輯畫面完全展開專案內容，Actions 的已完成項目預設折疊，可點開查看，並可向右滑完成、向左滑刪除；所有「未完成」文字統一顯示藍色。
- 開啟專案 Action 時以「相關Action」列出同專案尚未完成的 Actions；一般 Action 不顯示此區塊。
- Action 編輯頁頂端提供儲存與取消，底端提供完成、轉為專案Action與刪除；Ctrl／Cmd+Enter 也可儲存。綠色「完成」會標記 Done 並關閉，轉為專案可選既有進行中專案或新增。
- Action 與專案細節在編輯時自動排入雲端同步（停止輸入約 1.35 秒）。儲存保留修改、關閉並清空 Undo；取消還原本次編輯並同步，新增草稿也會撤回。同步狀態顯示於原有同步列，需連接 Google 才能寫入雲端。
- 使用期間會在 Google 憑證即將到期時自動續期；斷線後仍可瀏覽與編輯，本機修改會保留，並在自動儲存失敗時以 Toast 提醒重新登入。
- 電腦版日誌的 Action 編輯顯示於右側面板，暫時取代行事曆；開啟前後維持相同欄寬，左側清單使用左邊捲軸並標示目前 Action，左右清單與內容可獨立捲動。手機版維持全螢幕編輯。
- 專案內容與一般 Action 細節共用逐行條列編輯器：Enter 新增條列、Tab 縮排、Shift+Tab 退階，可展開／收合並調整文字大小與七種主題色
- 支援跨行選取文字、Undo（Ctrl／Cmd+Z）；電腦版 Shift+↑／↓ 會直接進入多選，Esc 可離開多選。複製與剪下後只會清除選取項目並保留多選模式，貼到空白條列時會替換該條列並保留完整階層。剪貼簿按鈕需瀏覽器授權。
- 每天右上角的「＋」會以當天日期新增 Action；同步資訊顯示雲端修改日期與時間（精確到秒）
- 編輯視窗採全螢幕；電腦側邊／手機底部圖示工具列支援階層展開收合、多選上移下移、顏色、大小與插圖，上下方向鍵可切換條列
- 圖片占位與連結統一顯示「【Pic】」；游標預覽約占半個螢幕面積
- Action 可拖曳至其他日期或桌面月曆，拖曳時預覽落點；也提供觸控拖曳把手
- 日誌可切換一週、一個月、全部未來；一週之外只顯示有 Action 的日期。寬螢幕右側月曆以每個 Action 一個 5×5 px 優先度色塊呈現（含 Done，待確認為黃色），空白日期不顯示色塊
- Quick action 直接開啟細節編輯器，名稱以空白儲存，清單顯示「Unnamed action！」；顯示黃色待確認，選定四種重要度之一後解除待確認
- 新增 Action 預設「今天完成」；重要度未選取呈現彩色外框，選取後呈現實心色塊
- 引用圖片會上傳至以專案命名的 Google Drive 資料夾；指向連結可預覽並開啟大圖
- 支援紅、綠、藍、無色四級重要度按鈕，並可新增、編輯、完成、軟刪除與復原
- Action 日期使用週六、週日紅字的月曆選擇器
- 過去未完成事項可半自動順延；同一項目同一天不會重複建立，紅／綠 Highlight 會在後續完成後轉灰
- 待整理的未完成 Highlight Action 會直接顯示重要度
- 後台僅顯示日誌文件 ID 與圖片上傳資料夾 ID，以及開啟／同步控制；舊 Debug 介面已移除
- 未完成 Actions 支援全選、全不選、原日期標記 Done、移到今天與移到下一個日曆週的相同星期幾（週一至週日）
- 圖片根資料夾須在後台設定；新專案圖片存於根目錄內的專案名稱子資料夾，一般 Action 圖片存於 Actions 子資料夾。既有圖片不自動搬移
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
- `ui.js`：日誌首頁、Action／專案互動與後台設定
- `outline.js`：一般 Action 與專案共用的階層條列編輯器
- `journal.js`：日誌日期拖曳、月份日曆與範圍控制
- `app.js`：只供舊版快取頁面轉接三大模組，不放應用功能

## GitHub Pages 升级
1. 上傳／覆蓋 index.html、app.js、sync.js、content.js、outline.js、journal.js、ui.js、manifest.webmanifest、sw.js、favicon 與 app icon 檔案。
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
- token 到期或浏览器结束会话后，點「登入」
- Google 登入元件載入失敗或逾時可點登入重試；若仍在載入，看到就緒訊息後再點一次，以直接點擊開啟登入視窗。瀏覽器限制暫存不會中斷初始化，但無法記住工作階段。

目前的「續期」仍是 Google 瀏覽器授權流程，可能顯示視窗；取消或被阻擋後不再每分鐘重試，可自行點登入重新連接。重新連接會恢復定期同步，並保留尚未上傳的編輯內容。

OAuth 若設定為 External / Testing，Drive 授權在 7 天後失效。長期自用應在 Google Auth Platform 的 Audience 頁將 Publishing status 改為 In production；這不會延長 access token 本身的有效期限，也不等於通過 Google 驗證。

若要長期免互動重新登入，需要後端 OAuth authorization-code 流程，安全保存 refresh token 並自動換發 access token。Google client secret 與 refresh token 不可放進 GitHub Pages 的公開前端。

## 同步
### 本機備份與離線使用
- 曾經在線上開啟新版網站後，應用程式會快取介面。斷網時仍可開啟日誌、讀取筆記及新增 Quick action。
- 每份日誌依 Drive File ID 保存獨立的本機副本、最後同步內容和版本；沒有設定 ID 的速記也會保存在本機。重新整理或關閉後再開啟會先還原副本。
- 網路恢復且登入仍有效時會重新同步；登入到期則先保留本機筆記，登入後再同步。登出不清除筆記，並會停止自動連線，直到再次按登入。
- 雙方都修改時暫停同步，按「處理同步衝突」逐項選擇 Action／專案欄位；筆記可選「保留兩邊」。不衝突的欄位與新增項目會一併保留。確認後再次檢查雲端版本，有新變更就重新顯示衝突。
- 合併前兩份原始內容會另外存入本機備份。後台的「匯出本機備份」可下載目前筆記的 Markdown 檔。
- 本機副本屬於這個瀏覽器與網站網址；清除網站資料或瀏覽器回收儲存空間會移除副本。首次造訪需要網路，離線時不能上傳或下載尚未快取的 Drive 圖片。

每 5 秒只请求一次 metadata；version 没变就不下载正文。
输入停止 1.2 秒后自动保存，保存前会再确认 Drive version。
若本机有修改而云端 version 又改变，自动保存暂停并显示冲突。

冲突时：
- 使用云端版：本机旧版会先备份到浏览器 localStorage
- 保留本地：云端旧版先备份，再明确覆盖 Drive
- 暂不处理：保持冲突状态，自动保存暂停
