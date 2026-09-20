# 企業微信微盤 WEB 同步驗證

這是與 Drive Memo 正式程式隔離的可行性測試。目前驗證的「微盤」是**企業微信微盤**。

## 結論

- 微盤 API 可供 WEB 應用同步，但必須經過後端。
- 不能由 GitHub Pages 直接呼叫：`Corp Secret` 不能公開，實測的 API CORS 預檢也回傳 403。
- 適合的架構是：瀏覽器 → 自己的 HTTPS 後端 → 企業微信 API。
- 微盤檔案列表有 `mtime` / `md5` / `sha`，可做版本檢查；正式雙向同步仍要加上條件寫入或應用端衝突保護，不可靜默覆蓋。

## 需要的企業微信設定

1. 在企業微信管理後台的「協作 → 微盤 → API」將自建應用加入可呼叫清單。
2. 取得 Corp ID、該應用的 Secret、測試空間 ID 與目錄 ID。
3. 憑證只放在後端環境變數，不放入 `config.js`、前端 JavaScript 或 Git。

## 本機執行

### 雙擊啟動

1. 將 `.env.example` 複製為 `.env`，填入真實後端設定。
2. 雙擊 `START-WEDRIVE-TEST.cmd`。
3. 啟動器會等待後端就緒，然後自動開啟 `http://127.0.0.1:8787/`。
4. 在啟動器視窗按 Enter 即可停止後端。

`.env` 已被 Git 忽略，不會被提交。沒有 `.env` 時測試頁仍會啟動，但只會顯示尚未完成憑證設定。

### 手動啟動

PowerShell 範例：

```powershell
$env:WEDRIVE_CORP_ID = "ww..."
$env:WEDRIVE_CORP_SECRET = "..."
$env:WEDRIVE_SPACE_ID = "..."
$env:WEDRIVE_FATHER_ID = "..."
npm start
```

開啟 `http://127.0.0.1:8787`，先執行「唯讀連線測試」。

寫入測試預設關閉。只有確定目標是測試目錄時，才額外設定：

```powershell
$env:WEDRIVE_ALLOW_WRITE = "true"
```

這會在目標目錄新增一個帶時間的 `.txt` 測試檔，不會刪除或覆蓋既有檔案。

## 自動測試

```powershell
npm test
npm run probe:network
```

`npm test` 不需憑證或網路。`probe:network` 只使用無效假憑證測試官方主機與 CORS，不會讀寫微盤資料。

## 若要接回 Drive Memo

先完成一個真實微盤目錄的「列出 → 上傳測試檔 → 再列出」驗證。通過後再在 Drive Memo 現有 `sync.js` 之上做可切換的同步 provider，不要把微盤 API 散落進 UI 事件。
