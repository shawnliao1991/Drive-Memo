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



第一個核心功能：牛馬日誌



產品概念：

「牛馬日誌」是以日期為主軸的個人 Bullet Journal。使用者每天記下要推進的事情，從今天開始沿時間軸查看待辦、完成事項與未來一週的安排。

牛馬日誌是預設首頁與主要使用界面。現有「跨裝置狀態測試」與 Sync Debug 必須移到獨立頁面，例如 `#sync-debug`，平常不出現在首頁；需要驗證同步時再從選單進入。



核心資料概念：

1. Item：內容模組的共同基底，明確以 `kind: task | project` 區分「事情」與「專案」。兩者都有穩定 ID、標題、建立時間、更新時間與軟刪除狀態，但生命週期與詳情內容不同。

2. Daily Bullet：代表某個日期要執行的 Action，包含所屬 Item、日期、副標題 Action、重要度、狀態、建立與完成時間，以及順延來源與去向。事情的 Bullet 就是事情本身；專案的 Bullet 則指向該專案當下的一個 Project Action。

3. 顯示時以 Item 標題作為主標題，以當天 Daily Bullet 的 Action 作為副標題。點開項目後可查看與編輯專案細節、歷次 Action、完成與順延紀錄。

4. Item 與 Daily Bullet 使用穩定唯一 ID。刪除預設採可復原的軟刪除並提供 Undo，避免快速操作或同步時永久遺失資料。



內容模組：事情與專案



事情 `task`：

- 事情是單次、可以直接完成的簡單 Action，不要求建立專案資料、Note 或後續 Action。
- 事情完成後生命週期即結束；完成紀錄仍保留在所屬日期與歷史資料中。
- 事情可以隨時「升級為專案」。升級時沿用原 Item ID、Bullet、完成狀態與時間，不複製或丟失既有歷史；只把 `kind` 改為 `project`，並建立專案所需的狀態與容器。
- 升級後，原事情內容成為專案的第一筆 Action 或起始歷史，使用者可以補上專案說明、Note 與下一個 Action。



專案 `project`：

- 專案代表需要持續推進的成果，包含穩定標題、詳細說明、多筆 Note、一連串 Project Action、近期動態與完整歷史。
- 專案狀態分為 `open` 與 `closed`。Open 專案可建立與推進 Action；Closed 專案保留全部資料但不再出現在首頁待辦中。兩種狀態可以切換，切換時間必須留下紀錄。
- 關閉專案不等同刪除，也不應靜默刪除或完成尚未處理的 Action；未完成 Action 保留原狀，重新 Open 後可繼續處理。
- Note 是專案底下的獨立紀錄，至少包含穩定 ID、內容、建立時間、更新時間與軟刪除時間。Note 不直接出現在首頁時間軸，只出現在專案頁及近期動態。



Project Action：

- 每個 Project Action 至少包含穩定 ID、專案 ID、Action 內容、預定日期、重要度、狀態、建立時間、完成時間，以及前一個／下一個 Action 的關聯。
- 首頁每天看到的是 Project Action 對應的 Daily Bullet；Bullet 主標題顯示專案名稱，副標題顯示當天 Action。Bullet 不複製專案 Note。
- 完成專案 Action 時，UI 同時提供「下一個 Action」的內容與預定日期。使用者可以直接完成而暫不安排下一步，也可以在同一次操作中完成目前 Action 並建立下一個 Action。
- 「完成目前 Action＋建立下一個 Action」必須是內容模組的一次原子更新，並使用穩定操作 ID，避免跨裝置同步或重試造成目前 Action 重複完成、下一個 Action 重複建立。
- 下一個 Action 建立後，以 `previousActionId` / `nextActionId` 串起專案推進鏈；改期與順延仍保留原日期與變更紀錄，不直接覆寫歷史。



專案近期動態與歷史：

- 內容模組以 Project Action、Note 與專案狀態變更作為權威資料，產生統一的專案活動流；至少涵蓋 Action 建立、完成、順延／改期，Note 新增／修改，以及 Open／Closed 切換。
- 「近期動態」按時間倒序提供最近的活動，供專案 Bullet 點開後直接顯示；「完整歷史」保留專案從建立到現在的完整推進過程，供日後回顧。
- 活動流不得只保存一段可被覆寫的文字快照。每筆活動需能追溯到來源 Action、Note 或狀態變更，避免跨裝置合併後失去上下文。
- 專案 Bullet 點開時進入該專案的近期動態，而不是一般事情的簡單編輯框；仍可由近期動態繼續進入完整專案頁。



專案管理頁：

- 新增獨立的專案管理頁，預設列出 Open 專案，並可切換查看 Closed 專案。
- 專案列表至少顯示專案名稱、目前／下一個 Action、預定日期、最後活動時間與 Open／Closed 狀態。
- 專案詳情包含專案說明、目前 Action、下一步安排、Note、近期動態、完整歷史，以及 Open／Closed 切換。
- Closed 專案仍可搜尋、查看、重新 Open；關閉與重開都不改變既有 Action、Note 與歷史 ID。



內容格式升級與相容：

- 下一次內容格式升級需為既有 Item 增加明確的 `kind`。舊版 v2 Item 預設遷移為 `task`，不得僅因存在多筆順延 Bullet 就自動推測為專案。
- 升級成專案及完成後建立下一個 Action，都只能透過內容模組提供的操作完成；UI 不得自行拼接 Item、Action、Note 或活動歷史。
- 事情、專案、Action 與 Note 的所有狀態仍儲存在同一份 Drive 文件，沿用同步模組的版本比對、儲存佇列與衝突保護。



Bullet 重要度：

- 紅色 `urgent`：必須立即處理。
- 綠色 `today`：今天必須完成。
- 藍色 `soon`：這幾天完成即可。
- 無色 `someday`：不急，可以慢慢做。

顏色不能是唯一識別方式；畫面同時要有文字、圖示或其他可辨識標記，兼顧色弱與小螢幕使用者。



Bullet 狀態與操作：

- 使用者可以手動新增、刪除、修改 Bullet，也可以更新重要度、Action 與完成狀態。
- 基本狀態至少包含：待處理 `todo`、已完成 `done`、已順延 `migrated`。軟刪除使用 `deletedAt` 記錄，不與工作狀態混在一起。
- 已完成項目顯示為灰色，但保留標題、Action、完成日期與原重要度，讓歷史仍可理解。
- 所有變更都先經內容模組更新結構化資料，再交給同步模組保存；UI 不直接拼接儲存格式。



每日整理與順延：

1. 第一次進入新日期時，內容模組找出前一日仍未完成、且尚未順延的 Bullet，產生「待整理」清單，不直接刪除或覆蓋原紀錄。

2. UI 提供「全部順延到今天」與逐筆選擇。確認後建立今天的 Daily Bullet，保留 Item、Action 與重要度，並以 `carriedFrom` / `carriedTo` 串接來源與去向。

3. 順延操作必須具有穩定的 idempotency key，避免 PC 與手機同時整理時產生重複 Bullet。

若連續數日沒有開啟 App，不為每個空白日期重複建立 Bullet；下次開啟時直接把最後一筆未完成 Action 列入今天的待整理清單，同時保留最初日期與完整順延鏈。

4. 紅色與綠色 Bullet 即使順延，仍保留原日期的 Highlight 紀錄；當後續串接的任務完成時，原 Highlight 改為灰色。未完成時保留紅色或綠色的重要度標記。Highlight 卡片本身不在主副標題後附加日期，日期只由所屬時間軸區段呈現。

5. 藍色與無色 Bullet 順延後仍保留歷史紀錄，但不占用原日期 Highlight；一般時間軸可展開查看。



首頁資訊架構：

- 首頁採單一向下推進的未來時間軸，不設「過去做過什麼」與「接下來做什麼」獨立區塊。
- 第一個畫面從今天與明天開始，繼續向下捲動可查看接下來一週；預設產生今天起共八個日期區段。
- 每個日期區段直接顯示當日未完成 Bullet，不顯示「Todo」標題與數量。紅、綠、藍、無色均保留清楚的色彩分級，文字標籤只寫「立即處理」「今天完成」「這幾天」「慢慢做」，不重複描述顏色；卡片後方不顯示日期。
- 每個日期區段可顯示灰色的「Done」項目；今天預設展開，未來日期有完成項目時可展開查看。
- 預設排序為紅、綠、藍、無色；同重要度內保留手動排序，已完成項目移到當日完成區但不改變歷史順序。
- 日期時間軸按日期分組，完整日期以 `YYYY-MM-DD` 保存在資料與 HTML `datetime`，前景顯示為「9月5日 （六） 今天」。今天、明天、後天要顯示相對日期，其餘只顯示月日與星期；週六、週日的日期文字使用較淺顏色。
- 點擊 Bullet 開啟詳情面板；桌面可用側欄或對話框，iPhone / PWA 使用適合單手操作的 bottom sheet 或全頁詳情。



內容格式規劃：

內容格式由 `content.js` 定義結構化的 Items、Daily Bullets 與日期索引；下一次格式升級再加入 Projects、Project Actions、Notes 與可追溯的活動來源，並提供舊 Markdown v1 與現有 v2 的相容讀取及遷移。日期採本機日曆日 `YYYY-MM-DD`，時間保存 ISO timestamp；跨時區或夏令時間不得改變 Bullet 原本所屬日期。

同步仍以整份 Drive 文件為單位，沿用現有版本比對、儲存佇列與衝突保護。資料格式升級前必須先保留原始內容備份，並確保同一份文件不會被舊版 UI 靜默覆蓋。



第一階段實作範圍：

先完成資料格式 v2、牛馬日誌首頁、Bullet 新增／編輯／軟刪除／完成、四級重要度、Item 詳情、每日待整理與順延，以及獨立 Sync Debug 頁面。搜尋、標籤、多人協作、通知與進階統計不放進第一階段，避免主流程變複雜。



第二階段規劃：

先升級內容格式並完成 v2 相容遷移，再依序實作事情／專案類型、事情升級、專案 Action 接棒、Note 與活動流、專案管理頁、Open／Closed 切換，最後才把專案近期動態接回首頁 Bullet。每一步都要先完成內容模組操作與去重測試，再接 UI 與同步測試。



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

