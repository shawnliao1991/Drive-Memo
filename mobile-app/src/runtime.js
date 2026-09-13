import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { marked } from 'marked';
import { createAuth } from './auth.js';

window.marked = marked;
window.APP_CONFIG.DISABLE_SERVICE_WORKER = true;
if (Capacitor.isNativePlatform()) {
  window.APP_CONFIG.AUTH_NATIVE = true;
  window.APP_CONFIG.AUTH_BACKEND = false;
  window.DriveMemoNativeAuth = { create: callbacks => createAuth({ plugin: SocialLogin, config: { ...window.APP_CONFIG, ...window.DRIVE_MEMO_NATIVE_CONFIG }, platform: Capacitor.getPlatform() }, callbacks) };
} else {
  // Preview remains usable offline; Google sign-in must be verified on a native device.
  window.APP_CONFIG.AUTH_NATIVE = true;
  window.DriveMemoNativeAuth = { create: ({ onStatus }) => ({
    initialize: async () => { onStatus('App 預覽模式：可編輯本機筆記，Google 原生登入請使用手機。', ''); return false; },
    getToken: async () => { throw Error('AUTH_EXPIRED'); },
    login: () => onStatus('Google 原生登入請使用 Android／iPhone App。', ''),
    logout: async () => {}
  }) };
}
