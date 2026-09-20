# 微盤 API 與 WEB 同步測試報告

測試日期：2026-09-20

目標：企業微信微盤 API

## 已實測

| 項目 | 結果 | 說明 |
|---|---|---|
| API 主機連通 | 通過 | `gettoken` 以假 Corp ID 呼叫得到 HTTP 200 及官方錯誤碼 `40013` |
| 純前端 CORS | 不通過 | `file_list` 的 `OPTIONS` 預檢回傳 HTTP 403，無 `Access-Control-Allow-Origin` |
| 憑證安全性 | 不適合純前端 | Corp Secret 必須用於取得 token，不能放在 GitHub Pages |
| 後端 API client | 通過模擬測試 | 覆蓋 token 取得與快取、列檔、Base64 上傳與錯誤處理 |
| 真實微盤讀寫 | 待憑證 | 專案中沒有 Corp ID、Secret、Space ID 與 Folder ID |

## 判定

**可用於 WEB 同步，但必須有後端。** 現有 Drive Memo 的純 GitHub Pages 架構無法安全直連企業微信微盤。現有 Cloud Run 後端可作為日後整合點，但在真實憑證測試通過前不應替換 Google Drive 同步。

## 尚未驗證的關鍵點

1. 真實微盤空間的讀取權限。
2. 小型 Markdown 檔案實際上傳後的 `mtime` / `md5` 變化。
3. 微盤是否能原地更新同一檔案；若只能新增上傳，需要設計 snapshot 命名與垃圾回收策略。
4. 並發寫入時的衝突防護。若 API 沒有類似 `If-Match` 的條件寫入，必須在後端加入版本鎖。
