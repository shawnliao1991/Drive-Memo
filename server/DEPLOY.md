# Google 託管的長期登入

GitHub 保存程式碼；Cloud Run 提供網站與登入服務；Firestore 保存加密的 refresh token；Secret Manager 保存 OAuth client secret 與加密金鑰。不需要自己維護伺服器。

程式已備妥，部署與 Google OAuth 設定完成前，GitHub Pages 的登入方式不會改變。

## 首次設定

1. 在現有 Google Cloud 專案確認已綁定帳單。Cloud Run、Firestore、Secret Manager、建置與映像儲存依各自用量計費；免費額度不代表保證零費用。建議設定預算通知。
2. 在 Google Auth Platform → Audience 將狀態切換為 **In production**，否則 Drive 的測試授權仍會在 7 天失效。這與 Google OAuth 驗證是不同設定；視申請範圍可能仍出現未驗證提示。
3. 在 Clients 使用類型為 **Web application** 的 OAuth client。準備 client ID 與 client secret。secret 只輸入 Cloud Shell 的隱藏提示，別貼進聊天、前端或 GitHub。
4. 開啟 Google Cloud Console 的 Cloud Shell，取得專案：

   ```bash
   git clone https://github.com/shawnliao1991/Drive-Memo.git
   cd Drive-Memo
   bash server/deploy-cloud-shell.sh
   ```

   輸入 Cloud 專案 ID、區域（例如 asia-east1）、OAuth client ID、允許登入的 Google email。腳本會建立託管服務、Firestore 與兩個秘密，並只授予執行身分資料庫與指定秘密的存取權限。已有資源會重用。若組織限制建置權限或公開服務，需由專案管理者完成 Cloud Run 官方部署前置設定，腳本不會繞過限制。
5. 腳本完成會顯示網站網址與 `https://網站網址/auth/callback`。將後者完整加入 OAuth client 的 **Authorized redirect URIs**，不是 Authorized JavaScript origins。
6. 開啟新的 Cloud Run 網址，點登入並同意一次 Drive 授權。將原本日誌 File ID 與圖片資料夾 ID 填入新網站的後台；資料仍在同一份 Drive 文件，不需要搬移。原網站未同步的編輯須先完成同步。
7. 手機從新網址重新加入主畫面。往後使用此網址，舊 GitHub Pages 網址仍是舊的短效登入模式。

## 行為與限制

- 後端依需求換發 access token，不開 Google 視窗。瀏覽器只保存 HttpOnly / Secure / SameSite=Lax 登入 Cookie；access token 只留在前端記憶體，refresh token 不回傳到瀏覽器。
- 登入 Cookie 與後端工作階段為 180 天，使用時自動延長；服務冷啟動或部署後可從 Firestore 恢復。
- 本機測試可用 Node 24，設定 `PUBLIC_ORIGIN=http://localhost:8080` 與其他變數，再執行 `node server/auth-server.mjs`。用 `AUTH_DATA_FILE` 取代 `FIRESTORE_PROJECT_ID` 可使用加密檔案儲存；必須放在忽略的 personal/ 或原始碼目錄外。
- Google 撤銷授權、清除 Cookie、長期不使用或帳戶政策變更仍可能需要重新登入，無法承諾永久有效。
- Google／網路暫時失敗不刪除登入狀態；自動儲存失敗仍顯示 Toast。Google 明確回覆 invalid_grant 才撤銷該工作階段。
- Google 登入仍使用既有完整 Drive scope，與現有任意 File ID／圖片資料夾功能一致。
- 不要任意更換加密金鑰。換新金鑰後無法解密舊工作階段，必須重新授權；建議用 Secret Manager 保存既有版本。
- 設定 Firestore TTL 自動清除過期工作階段與 OAuth 暫存資料。TTL 清理非即時，程式會自行檢查到期時間。

## 後續更新

在 Cloud Shell 中進入同一個 clone，先 `git pull` 再執行同一支部署腳本。GitHub 的 push 本身不會更新 Cloud Run；須部署後才生效。首次部署前不要把正式使用網址切過去。

官方文件：[Cloud Run 從原始碼部署](https://cloud.google.com/run/docs/deploying-source-code)、[Secret Manager](https://cloud.google.com/run/docs/configuring/services/secrets)、[Google offline OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)、[OAuth Audience](https://support.google.com/cloud/answer/15549945?hl=en)。
