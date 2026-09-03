# Drive Memo Prototype

这个 Prototype 验证四件事：

1. 浏览器用 Google OAuth 登录
2. 透过 Google Drive API 读取一个现有 Markdown 文件
3. 网页用 JavaScript 编辑/呈现该文件
4. 网页把修改写回同一个 Drive 文件

## A. Google Cloud 设置

1. 打开 Google Cloud Console
2. 建立一个 Project
3. APIs & Services → Library → 启用 **Google Drive API**
4. OAuth consent screen：
   - Prototype 可设为 Testing
   - 把你自己的 Google 帐号加入 Test users
5. Credentials → Create Credentials → OAuth client ID
6. Application type 选 **Web application**
7. Authorized JavaScript origins 加：
   - `http://localhost:8080`
8. 复制 OAuth Client ID

## B. 修改 config.js

把：

`PASTE_YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com`

换成你的 Client ID。

把：

`YOUR_GOOGLE_EMAIL@gmail.com`

换成你允许登入的 Google 帐号。

## C. Drive 准备一个 Markdown 文件

例如建立 `prototype.md`：

```md
# Prototype

## Today
- Drive is my source of truth
- Web is only a view

## Pending
- [ ] AI editing
- [ ] Topic index
```

上传到 Google Drive。

从文件分享链接取得 File ID，例如：

`https://drive.google.com/file/d/1AbCdEfGh12345/view`

其中：

`1AbCdEfGh12345`

就是 File ID。

## D. 本机启动

不要直接双击 index.html，因为 OAuth 需要合法 HTTP origin。

在本资料夹运行：

```bash
python -m http.server 8080
```

然后浏览器打开：

`http://localhost:8080`

## E. 测试流程

1. Google 登入
2. 贴 File ID
3. 按「读取」
4. 修改 Markdown
5. 按「写回 Drive」
6. 回 Google Drive 检查内容是否真的改变

## Prototype 权限说明

为了直接读取你既有 Drive 中、只知道 File ID 的文件，本 Prototype 暂时请求：

`https://www.googleapis.com/auth/drive`

这是较大的 Drive 权限。

正式版建议改成：

- `drive.file`
- 搭配 Google Picker 让使用者明确挑选档案
- 或加 Server-side backend 保存 token / 做帐号限制

当前 `ALLOWED_EMAIL` 只是前端 UI 限制，不是正式安全边界。
