import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../src/auth.js';

function fixture(overrides = {}, callbacks = {}) {
  const calls = [];
  const plugin = {
    initialize: async () => {}, isLoggedIn: async () => ({ isLoggedIn: true }),
    getAuthorizationCode: async () => { calls.push('restore'); return { accessToken: 'restored' }; },
    login: async () => { calls.push('login'); return { result: { accessToken: { token: 'interactive' } } }; },
    logout: async () => { calls.push('logout'); }, ...overrides
  };
  const auth = createAuth({ plugin, platform: 'android', config: { GOOGLE_CLIENT_ID: 'web', ALLOWED_EMAIL: 'shawn@example.com' }, fetchImpl: async () => ({ ok: true, json: async () => ({ email: 'shawn@example.com' }) }) }, callbacks);
  return { auth, calls };
}
test('restores credentials without opening interactive login and caches the token', async () => {
  const { auth, calls } = fixture();
  assert.equal(await auth.initialize(), true);
  assert.equal(await auth.getToken(), 'restored');
  assert.deepEqual(calls, ['restore']);
});
test('missing session remains offline until explicit login', async () => {
  let resumed = 0;
  const { auth, calls } = fixture({ isLoggedIn: async () => ({ isLoggedIn: false }) }, { onReady: () => resumed++ });
  assert.equal(await auth.initialize(), false);
  assert.deepEqual(calls, []);
  await auth.login();
  assert.equal(resumed, 1);
  assert.equal(await auth.getToken(), 'interactive');
});
test('simultaneous refreshes share one SDK request', async () => {
  const { auth, calls } = fixture();
  await Promise.all([auth.getToken(true), auth.getToken(true)]);
  assert.deepEqual(calls, ['restore']);
});
test('logout invalidates an in-flight login before it can resume synchronization', async () => {
  let release, resumed = 0;
  const response = new Promise(resolve => { release = resolve; });
  const { auth, calls } = fixture({ login: () => response }, { onReady: () => resumed++ });
  const login = auth.login();
  await Promise.resolve();
  const logout = auth.logout();
  release({ result: { accessToken: { token: 'late' } } });
  await Promise.all([login, logout]);
  assert.equal(resumed, 0);
  assert.deepEqual(calls, ['logout']);
  await assert.rejects(auth.getToken(), /AUTH_EXPIRED/);
});
test('an unapproved account cannot yield a Drive token', async () => {
  const auth = createAuth({ plugin: { initialize: async () => {}, isLoggedIn: async () => ({ isLoggedIn: true }), getAuthorizationCode: async () => ({ accessToken: 'wrong-account' }) }, config: { ALLOWED_EMAIL: 'allowed@example.com' }, platform: 'android', fetchImpl: async () => ({ ok: true, json: async () => ({ email: 'other@example.com' }) }) });
  await assert.rejects(auth.getToken(), /允許名單/);
});
