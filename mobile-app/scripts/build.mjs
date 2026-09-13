import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const app = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(app, '..');
const output = path.join(app, 'dist');
await mkdir(output, { recursive: true });
const assets = ['config.js', 'content.js', 'merge.js', 'backend-auth.js', 'sync.js', 'outline.js', 'journal.js', 'ui.js', 'reminder-test.js', 'manifest.webmanifest', 'favicon.ico', 'favicon-16.png', 'favicon-32.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
for (const file of assets) await copyFile(path.join(root, file), path.join(output, file));
const ui = await readFile(path.join(output, 'ui.js'), 'utf8');
const registration = 'if("serviceWorker"in navigator)navigator.serviceWorker.register';
if (!ui.includes(registration)) throw Error('UI 快取入口已改變，請更新 App 建置轉接。');
await writeFile(path.join(output, 'ui.js'), ui.replace(registration, 'if(!global.APP_CONFIG.DISABLE_SERVICE_WORKER&&"serviceWorker"in navigator)navigator.serviceWorker.register'));
const sync = await readFile(path.join(output, 'sync.js'), 'utf8');
const auth = 'cfg.AUTH_BACKEND?global.DriveMemoBackendAuth.create';
if (!sync.includes(auth)) throw Error('同步登入入口已改變，請更新 App 建置轉接。');
await writeFile(path.join(output, 'sync.js'), sync.replace(auth, '(cfg.AUTH_NATIVE||cfg.AUTH_BACKEND)?(cfg.AUTH_NATIVE?global.DriveMemoNativeAuth:global.DriveMemoBackendAuth).create'));
let native = {};
try { native = JSON.parse(await readFile(path.join(app, 'native.config.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile(path.join(output, 'native-config.js'), `window.DRIVE_MEMO_NATIVE_CONFIG=${JSON.stringify(native)};\n`);
await build({ entryPoints: [path.join(app, 'src/runtime.js')], outfile: path.join(output, 'native-runtime.js'), bundle: true, format: 'iife', target: ['safari16', 'chrome110'] });
let html = await readFile(path.join(root, 'index.html'), 'utf8');
html = html.replace('<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>', '');
html = html.replace(/(<script src="\.\/config\.js"><\/script>)/, '$1\n<script src="./native-config.js"></script>\n<script src="./native-runtime.js"></script>');
await writeFile(path.join(output, 'index.html'), html);
console.log('已建立 mobile-app/dist，沿用根目錄最新功能。');
