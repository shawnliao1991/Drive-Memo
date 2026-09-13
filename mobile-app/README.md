# Drive Memo 手機 App

獨立的 Capacitor 手機專案，包含 Android 與 iOS 原生專案。建置時沿用上一層的日誌、Action、專案、條列編輯器、Drive 同步與衝突保護，不另存一套功能原始碼。

目前為可建置的開發版；尚未完成手機 OAuth 設定、簽署、實機驗證或商店發布，不是已可安裝的正式成品。

## 開始使用

安裝 Node.js 22 以上與 npm，在本資料夾執行：

```sh
npm ci
npm run build
npm run preview
```

預覽網址為 http://127.0.0.1:4173。預覽可操作並保存本機筆記；登入按鈕會說明需在手機使用原生 Google 登入。

```sh
npm test
npm run android
# 在安裝 Xcode 的 Mac：
npm run ios
```

`android`／`ios` 會重新建置、同步網頁資源並開啟對應 IDE。Android 需要 Android Studio 與 SDK；iOS 需要 macOS、Xcode 26 以上及簽署設定。請依原生專案目前設定安裝 SDK，不使用這台電腦既有的 Java 8 編譯。

## Google 登入設定

沿用上一層 `config.js` 的 Web Client ID 和允許帳號；請不要把 client secret 或 refresh token 寫入本專案。

Android：在相同 Google Cloud 專案建立 Android OAuth client，套件名稱為 `com.shawnliao.drivememo`，加入實際簽署憑證的 SHA-1。開發、正式簽署與 Play App Signing 的憑證需分別登記。在 Android Studio 的終端機執行 `gradlew signingReport` 可查開發憑證。

iOS：建立 bundle ID 為 `com.shawnliao.drivememo` 的 iOS OAuth client，複製 `native.config.example.json` 為 `native.config.json` 並填入 `iOSClientId`。在 Xcode → App target → Info → URL Types 加入 Google 提供的 REVERSED_CLIENT_ID URL scheme（通常為 `com.googleusercontent.apps.` 接 Client ID 前段）。選擇自己的 Development Team 後重新執行 `npm run ios`。

登入透過原生 SDK，恢復工作階段使用原生憑證 API，不在 WebView 載入 Google 登入頁。前端只保留短效 token 在記憶體；撤銷授權或 SDK 無法恢復時需手動重新登入。實際續期、取消授權與跨装置同步仍須使用已設定 OAuth 的手機驗證。

## 資料與既有功能

- 第一次進入 App，於後台填入現有 Drive 日誌 File ID 與圖片根資料夾 ID，即可存取同一份資料。
- 網站與 App 的本機儲存空間不同。切換前先在原網站完成同步；未同步內容可先匯出備份，不會自動搬進 App。
- 原生 App 把介面與 Markdown 解析器包在安裝檔內，停用網頁 service worker；功能更新需重新建置安裝。
- 本機編輯沿用既有本機副本；刪除 App 或清除資料仍會移除未同步筆記。
- 原本「iPhone 離線提醒測試」仍是 Apple 捷徑測試，不代表已完成原生通知或 Action 排程提醒。
- 圖片上傳、剪貼簿、匯出下載與 Apple 捷徑跳轉仍須實機驗證各平台的 WebView 行為。

## 專案位置

- `src/auth.js`：原生 Google 授權轉接及登出競態保護。
- `src/runtime.js`：原生與預覽環境入口、內建 Markdown 解析器。
- `scripts/build.mjs`：取用上一層功能、套用 App 專用登入／快取轉接。
- `android/`、`ios/`：可在各平台 IDE 開啟的原生專案。
- `dist/`：產生的 App 網頁資源，不提交 Git。
- `tests/`：登入測試與瀏覽器預覽驗證。

主網站的登入及 service worker 不受 App 建置影響。若日後修改根目錄的登入入口或快取註冊程式，建置腳本會要求更新轉接，避免默默套用失敗。

參考：[Capacitor 環境設定](https://capacitorjs.com/docs/getting-started/environment-setup)、[Google 登入插件設定](https://github.com/Cap-go/capacitor-social-login/blob/main/docs/setup_google.md)。
